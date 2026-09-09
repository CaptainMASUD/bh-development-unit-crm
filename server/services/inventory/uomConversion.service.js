import mongoose from "mongoose";
import InventoryUnit from "../../models/inventory/inventoryUnit.model.js";
import { roundQuantity } from "../../models/inventory/productStock.model.js";

const isId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const idKey = (value) => String(value?._id || value || "");

/**
 * Converts a quantity from one unit of measure to another.
 *
 * @param {Object} params
 * @param {mongoose.Types.ObjectId|string} params.tenantId
 * @param {Object} [params.product] - Optional populated product document or POJO
 * @param {mongoose.Types.ObjectId|string} params.fromUnitId
 * @param {mongoose.Types.ObjectId|string} params.toUnitId
 * @param {number} params.quantity
 * @param {mongoose.ClientSession} [params.session]
 * @returns {Promise<{ quantity: number, factor: number, fromUnit: Object, toUnit: Object }>}
 */
export async function convertUnitQuantity({
  tenantId,
  product = null,
  fromUnitId,
  toUnitId,
  quantity,
  session = null,
}) {
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty < 0) {
    throw Object.assign(new Error("Quantity to convert must be a non-negative number."), {
      statusCode: 400,
    });
  }

  const fromId = idKey(fromUnitId);
  const toId = idKey(toUnitId);

  // Identity conversion
  if (!fromId || !toId || fromId === toId) {
    return {
      quantity: roundQuantity(qty),
      factor: 1,
      fromUnit: null,
      toUnit: null,
    };
  }

  // Check product-specific UoM conversions first
  if (product && Array.isArray(product.uomConversions) && product.uomConversions.length) {
    const override = product.uomConversions.find(
      (conv) => idKey(conv.unit) === fromId || idKey(conv.unit) === toId
    );
    if (override) {
      const factor = Number(override.conversionFactor || 1);
      const isBaseToTarget = idKey(override.unit) === toId;
      const convertedQty = isBaseToTarget ? qty / factor : qty * factor;
      return {
        quantity: roundQuantity(convertedQty),
        factor: isBaseToTarget ? 1 / factor : factor,
        fromUnit: null,
        toUnit: null,
      };
    }
  }

  // Query tenant-scoped units
  const query = InventoryUnit.find({
    tenantId,
    _id: { $in: [fromId, toId] },
    status: { $ne: "archived" },
  });
  if (session) query.session(session);
  const units = await query.lean();

  const unitMap = new Map(units.map((u) => [idKey(u._id), u]));
  const fromUnit = unitMap.get(fromId);
  const toUnit = unitMap.get(toId);

  if (!fromUnit || !toUnit) {
    throw Object.assign(
      new Error(`Unit of measure was not found or is archived in this company.`),
      { statusCode: 404 }
    );
  }

  // Incompatible unit types check (e.g. weight cannot convert to volume or count without density)
  if (fromUnit.unitType !== toUnit.unitType && fromUnit.unitType !== "other" && toUnit.unitType !== "other") {
    throw Object.assign(
      new Error(
        `Cannot convert between incompatible unit types: ${fromUnit.unitType} (${fromUnit.name}) and ${toUnit.unitType} (${toUnit.name}).`
      ),
      { statusCode: 400 }
    );
  }

  // Resolve conversion factor to a common base unit
  // Direct base-derived relationship:
  // e.g. fromUnit is Box (base: Pcs, factor: 12), toUnit is Pcs -> qty * 12
  if (idKey(fromUnit.baseUnit) === toId) {
    const factor = Number(fromUnit.conversionFactor || 1);
    return {
      quantity: roundQuantity(qty * factor),
      factor,
      fromUnit,
      toUnit,
    };
  }

  // e.g. fromUnit is Pcs, toUnit is Box (base: Pcs, factor: 12) -> qty / 12
  if (idKey(toUnit.baseUnit) === fromId) {
    const factor = Number(toUnit.conversionFactor || 1);
    return {
      quantity: roundQuantity(qty / factor),
      factor: 1 / factor,
      fromUnit,
      toUnit,
    };
  }

  // Both share the same baseUnit:
  // e.g. fromUnit is Carton (base: Pcs, factor: 24), toUnit is Box (base: Pcs, factor: 12)
  if (fromUnit.baseUnit && toUnit.baseUnit && idKey(fromUnit.baseUnit) === idKey(toUnit.baseUnit)) {
    const fromFactor = Number(fromUnit.conversionFactor || 1);
    const toFactor = Number(toUnit.conversionFactor || 1);
    const combinedFactor = fromFactor / toFactor;
    return {
      quantity: roundQuantity(qty * combinedFactor),
      factor: combinedFactor,
      fromUnit,
      toUnit,
    };
  }

  throw Object.assign(
    new Error(
      `No conversion relationship defined between unit "${fromUnit.name}" and "${toUnit.name}".`
    ),
    { statusCode: 400 }
  );
}
