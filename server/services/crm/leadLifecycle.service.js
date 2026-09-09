const fail = (message) => { throw Object.assign(new Error(message), { statusCode: 409 }); };

export function assertLeadCanWin(lead, reason) {
  if (lead.pipelineStage !== "negotiation") fail("Only a lead in Negotiation can be won and converted.");
  if (!String(reason || "").trim()) fail("A final negotiation win reason is required.");
}

export function assertLeadReadyForProposal(lead) {
  const requirement = lead?.requirement || {};
  const missing = [
    ["summary", requirement.summary],
    ["expected solution", requirement.expectedSolution],
    ["timeline", requirement.timeline],
    ["decision maker", requirement.decisionMaker],
  ].filter(([, value]) => !String(value || "").trim()).map(([label]) => label);
  if (missing.length) fail(`Complete Discovery before creating or moving to Proposal. Missing: ${missing.join(", ")}.`);
}

export function assertLeadTransition(from, to) {
  if (["won", "lost"].includes(from)) fail("Closed leads cannot change stage.");
  if (to === from) return;
  if (to === "lost") {
    if (from !== "negotiation") fail("A lead can be closed as Lost after the final Negotiation discussion.");
    return;
  }
  const next = { new: "qualified", qualified: "discovery", discovery: "proposal" };
  if (next[from] !== to) fail("Follow the lead lifecycle. Accept a sent proposal to enter Negotiation; use Mark Won to convert.");
}

export function proposalOrderLines(items = []) {
  if (!items.length) fail("The accepted proposal needs at least one product before winning.");
  return items.map((item) => {
    const qty = Number(item.qty), price = Number(item.unitPrice ?? 0), discount = Number(item.discount ?? 0);
    if (!item.productId || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price < 0 || !Number.isFinite(discount) || discount < 0 || discount > qty * price) {
      fail("Every proposal line needs a product, positive quantity, and valid price and discount.");
    }
    const subtotal = Math.round(qty * price * 100) / 100;
    return { productId: item.productId, name: item.nameSnapshot || "Item", orderedQty: qty, unitPrice: price, discountType: "fixed", discountValue: discount, lineSubtotal: subtotal, lineDiscount: discount, lineTax: 0, taxRate: 0, lineTotal: Math.round((subtotal - discount) * 100) / 100 };
  });
}
