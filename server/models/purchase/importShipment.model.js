import mongoose from "mongoose";

export const IMPORT_SHIPMENT_STATUSES = [
  "planned",
  "booked",
  "shipped",
  "in_transit",
  "arrived",
  "documents_received",
  "customs_clearance",
  "customs_cleared",
  "delivered",
  "closed",
  "cancelled",
];

const clean = (value) => String(value ?? "").trim();

const containerSchema = new mongoose.Schema(
  {
    containerNo: { type: String, trim: true, uppercase: true, maxlength: 80, default: "" },
    sealNo: { type: String, trim: true, uppercase: true, maxlength: 80, default: "" },
    containerType: { type: String, trim: true, uppercase: true, maxlength: 40, default: "" },
  },
  { _id: true }
);

const importShipmentSchema = new mongoose.Schema(
  {
    shipmentNo: { type: String, required: true, trim: true, uppercase: true, maxlength: 80 },
    commercialLC: { type: mongoose.Schema.Types.ObjectId, ref: "CommercialLC", required: true, index: true },
    purchaseOrder: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseOrder", required: true, index: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true, index: true },
    shipmentMode: { type: String, enum: ["sea", "air", "road", "rail", "courier", "other"], default: "sea", index: true },
    carrierName: { type: String, trim: true, maxlength: 180, default: "" },
    vesselName: { type: String, trim: true, maxlength: 180, default: "" },
    voyageNo: { type: String, trim: true, maxlength: 100, default: "" },
    billOfLadingNo: { type: String, trim: true, uppercase: true, maxlength: 160, default: "", index: true },
    airwayBillNo: { type: String, trim: true, uppercase: true, maxlength: 160, default: "", index: true },
    bookingReference: { type: String, trim: true, maxlength: 160, default: "" },
    portOfLoading: { type: String, trim: true, maxlength: 180, default: "" },
    portOfDischarge: { type: String, trim: true, maxlength: 180, default: "" },
    finalDestination: { type: String, trim: true, maxlength: 250, default: "" },
    etd: { type: Date, default: null, index: true },
    eta: { type: Date, default: null, index: true },
    actualDepartureAt: { type: Date, default: null },
    actualArrivalAt: { type: Date, default: null },
    customsEntryNo: { type: String, trim: true, uppercase: true, maxlength: 160, default: "" },
    customsClearedAt: { type: Date, default: null },
    cnfAgentName: { type: String, trim: true, maxlength: 180, default: "" },
    containers: { type: [containerSchema], default: [] },
    goodsReceipts: [{ type: mongoose.Schema.Types.ObjectId, ref: "GoodsReceipt" }],
    status: { type: String, enum: IMPORT_SHIPMENT_STATUSES, default: "planned", index: true },
    notes: { type: String, trim: true, maxlength: 3000, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, optimisticConcurrency: true }
);

importShipmentSchema.index({ shipmentNo: 1 }, { unique: true });
importShipmentSchema.index({ commercialLC: 1, status: 1, eta: 1 });
importShipmentSchema.index({ purchaseOrder: 1, status: 1, createdAt: -1 });

importShipmentSchema.pre("validate", function () {
  this.shipmentNo = clean(this.shipmentNo).toUpperCase();
  this.billOfLadingNo = clean(this.billOfLadingNo).toUpperCase();
  this.airwayBillNo = clean(this.airwayBillNo).toUpperCase();
  this.customsEntryNo = clean(this.customsEntryNo).toUpperCase();
  this.shipmentMode = clean(this.shipmentMode || "sea").toLowerCase();
  this.status = clean(this.status || "planned").toLowerCase();
  for (const item of this.containers || []) {
    item.containerNo = clean(item.containerNo).toUpperCase();
    item.sealNo = clean(item.sealNo).toUpperCase();
    item.containerType = clean(item.containerType).toUpperCase();
  }
  if (this.etd && this.eta && new Date(this.eta) < new Date(this.etd)) {
    this.invalidate("eta", "ETA cannot be before ETD.");
  }
});

export default mongoose.model("ImportShipment", importShipmentSchema);
