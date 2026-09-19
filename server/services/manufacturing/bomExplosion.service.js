import BillOfMaterial from "../../models/manufacturing/billOfMaterial.model.js";
import Product from "../../models/inventory/product.model.js";

const keyOf = (v) => String(v?._id || v || "");
const round = (v) => Math.round(Number(v || 0) * 1e6) / 1e6;

export const getEffectiveBom = async ({ productId, date = new Date(), bomId = null, session = null }) => {
  const q = bomId
    ? BillOfMaterial.findById(bomId)
    : BillOfMaterial.findOne({
        product: productId,
        status: "active",
        $and: [
          { $or: [{ effectiveFrom: null }, { effectiveFrom: { $lte: date } }] },
          { $or: [{ effectiveTo: null }, { effectiveTo: { $gte: date } }] },
        ],
      }).sort({ version: -1 });
  if (session) q.session(session);
  return q.lean();
};

export const explodeBom = async ({ productId, quantity, bomId = null, date = new Date(), session = null, maxDepth = 10 }) => {
  const totals = new Map();
  const tree = [];
  const visit = async ({ pid, qty, selectedBomId = null, depth = 0, path = [] }) => {
    if (depth > maxDepth) throw Object.assign(new Error("BOM explosion exceeded maximum depth."), { statusCode: 409 });
    if (path.includes(keyOf(pid))) throw Object.assign(new Error("Circular BOM dependency detected."), { statusCode: 409 });
    const bom = await getEffectiveBom({ productId: pid, bomId: selectedBomId, date, session });
    if (!bom) return false;
    const factor = Number(qty) / Number(bom.outputQuantity || 1);
    for (const line of bom.lines || []) {
      if (line.isAlternative) continue;
      const base = Number(line.quantity || 0) * factor;
      const required = round(base * (1 + Number(line.scrapPercent || 0) / 100));
      const childBom = await getEffectiveBom({ productId: line.product, date, session });
      if (childBom) {
        tree.push({ parent: keyOf(pid), product: keyOf(line.product), quantity: required, depth: depth + 1, manufactured: true });
        await visit({ pid: line.product, qty: required, selectedBomId: childBom._id, depth: depth + 1, path: [...path, keyOf(pid)] });
      } else {
        const key = keyOf(line.product);
        const current = totals.get(key) || { product: line.product, quantity: 0, unit: line.unit || null, warehouse: line.issueWarehouse || null, location: line.issueLocation || null };
        current.quantity = round(current.quantity + required);
        totals.set(key, current);
        tree.push({ parent: keyOf(pid), product: key, quantity: required, depth: depth + 1, manufactured: false });
      }
    }
    return true;
  };
  const found = await visit({ pid: productId, qty: Number(quantity), selectedBomId: bomId });
  if (!found) throw Object.assign(new Error("No active BOM was found for the product."), { statusCode: 409 });
  return { requirements: [...totals.values()], tree };
};

export const estimateBomMaterialCost = async ({ requirements = [], session = null }) => {
  const ids = [...new Set(requirements.map(x => keyOf(x.product)))];
  const q = Product.find({ _id: { $in: ids } }).select("standardCost purchasePrice costingMethod");
  if (session) q.session(session);
  const products = await q.lean();
  const map = new Map(products.map(p => [String(p._id), p]));
  return round(requirements.reduce((sum, r) => {
    const p = map.get(keyOf(r.product));
    return sum + Number(r.quantity || 0) * Number(p?.standardCost || p?.purchasePrice || 0);
  }, 0));
};
