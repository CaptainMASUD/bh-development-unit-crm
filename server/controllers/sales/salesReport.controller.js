import { SalesQuotation } from "../../models/sales/salesQuotation.model.js";
import { SalesOrder } from "../../models/sales/salesOrder.model.js";
import { SalesInvoice } from "../../models/sales/salesInvoice.model.js";
import { DeliveryNote } from "../../models/sales/deliveryNote.model.js";
import { assertTenant } from "../../utils/salesError.js";

const money = (value) => Math.round(Number(value || 0) * 100) / 100;

export const getSalesSummary = async (req, res) => {
  assertTenant(req);
  const from = req.query.from ? new Date(req.query.from) : null;
  const to = req.query.to ? new Date(req.query.to) : null;
  const dateMatch = {};
  if (from && !Number.isNaN(from.getTime())) dateMatch.$gte = from;
  if (to && !Number.isNaN(to.getTime())) { to.setHours(23, 59, 59, 999); dateMatch.$lte = to; }
  const invoiceMatch = { status: { $nin: ["draft", "void", "cancelled"] } };
  if (Object.keys(dateMatch).length) invoiceMatch.invoiceDate = dateMatch;

  const [invoiceRows, quotationRows, orderRows, deliveryRows, topCustomers] = await Promise.all([
    SalesInvoice.aggregate([
      { $match: invoiceMatch },
      { $group: {
        _id: null,
        invoiced: { $sum: "$totals.grandTotal" },
        paid: { $sum: "$paidAmount" },
        due: { $sum: "$dueAmount" },
        tax: { $sum: "$totals.taxTotal" },
        cogs: { $sum: "$accountingPosting.cogsAmount" },
        invoiceCount: { $sum: 1 },
      } },
    ]),
    SalesQuotation.aggregate([{ $group: { _id: "$status", count: { $sum: 1 }, value: { $sum: "$totals.grandTotal" } } }, { $sort: { count: -1 } }]),
    SalesOrder.aggregate([{ $group: { _id: "$status", count: { $sum: 1 }, value: { $sum: "$totals.grandTotal" } } }, { $sort: { count: -1 } }]),
    DeliveryNote.aggregate([{ $group: { _id: "$status", count: { $sum: 1 }, quantity: { $sum: { $sum: "$lines.quantity" } } } }, { $sort: { count: -1 } }]),
    SalesInvoice.aggregate([
      { $match: invoiceMatch },
      { $group: { _id: "$customerId", invoiced: { $sum: "$totals.grandTotal" }, paid: { $sum: "$paidAmount" }, due: { $sum: "$dueAmount" } } },
      { $sort: { invoiced: -1 } },
      { $limit: 10 },
      { $lookup: { from: "customers", localField: "_id", foreignField: "_id", as: "customer" } },
      { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
      { $project: { invoiced: 1, paid: 1, due: 1, customer: { _id: "$customer._id", name: "$customer.name", companyName: "$customer.companyName" } } },
    ]),
  ]);
  const totals = invoiceRows[0] || {};
  const netSales = money(Number(totals.invoiced || 0) - Number(totals.tax || 0));
  const grossProfit = money(netSales - Number(totals.cogs || 0));
  return res.json({
    success: true,
    data: {
      summary: {
        invoiced: money(totals.invoiced), paid: money(totals.paid), due: money(totals.due),
        tax: money(totals.tax), netSales, cogs: money(totals.cogs), grossProfit,
        grossMarginPercent: netSales > 0 ? money(grossProfit / netSales * 100) : 0,
        invoiceCount: Number(totals.invoiceCount || 0),
      },
      quotations: quotationRows,
      orders: orderRows,
      deliveries: deliveryRows,
      topCustomers,
      filters: { from: from || null, to: to || null },
    },
  });
};
