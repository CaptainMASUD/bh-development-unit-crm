import CashAccount from "../../models/cashAccount.model.js";
import BankAccount from "../../models/bankAccount.model.js";
import BankTransaction from "../../models/bankTransaction.model.js";
import JournalEntry from "../../models/journalEntry.model.js";
import Product from "../../models/inventory/product.model.js";
import PurchaseOrder from "../../models/purchaseOrder.model.js";
import { PendingInventory } from "../../models/inventory/inventoryOperations.model.js";
import { PurchaseDue, PurchasePayment } from "../../models/purchaseWorkflow.model.js";
import { createPostedJournal, resolveAccountingAccount, roundMoney } from "../../services/accountingPosting.service.js";
import { assignDocumentNumber } from "../administration/documentNumbering.service.js";

const opt=(session)=>session?{session}:undefined;
const makeRef=(p,id)=>`${p}-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${String(id).slice(-6).toUpperCase()}`;
const makeNumber=async(tenantId,typeKey,session)=> (await assignDocumentNumber({tenantId,typeKey,session,source:"purchase.execution"})).value;
const ledgerBalance=async(account,session)=>{const rows=await JournalEntry.aggregate([{$match:{status:"posted","lines.account":account}},{$unwind:"$lines"},{$match:{"lines.account":account}},{$group:{_id:null,debit:{$sum:"$lines.debit"},credit:{$sum:"$lines.credit"}}}]).session(session);return roundMoney(Number(rows[0]?.debit||0)-Number(rows[0]?.credit||0));};
export const isFinalizedPurchaseIssue = (issue = {}) => issue.status === "completed" && Boolean(issue.purchaseOrder);
export async function resolveAndLockTreasury(issue,session){const type=issue.paymentAccountType,id=type==="cash"?issue.cashAccount:issue.bankAccount;if(!id)throw Object.assign(new Error("Select an active payment account."),{statusCode:400});let record,ledger,name;if(type==="cash"){record=await CashAccount.findOneAndUpdate({_id:id,isActive:true},{$inc:{paymentVersion:1}},{new:true,session}).populate("account");ledger=record?.account;name=record?.name;}else{record=await BankAccount.findOneAndUpdate({_id:id,status:"active"},{$inc:{paymentVersion:1}},{new:true,session}).populate("ledgerAccount");ledger=record?.ledgerAccount;name=record?.accountName;if(!issue.bankCheckNumber)throw Object.assign(new Error("Bank check number is required for bank payment."),{statusCode:400});}if(!record||!ledger||ledger.type!=="asset")throw Object.assign(new Error("Payment account is inactive or not linked to an asset ledger."),{statusCode:409});return{type,id:record._id,ledger,name};}
export async function postPurchasePayment({
  issue,
  amount,
  userId,
  session,
  due = null,
  idempotencyKey,
  tenantId = null,
  paymentDate = new Date(),
  note = "",
  reference = "",
}) {
  const prior = await PurchasePayment.findOne({ idempotencyKey }).session(session);
  if (prior) return prior;
  const treasury = await resolveAndLockTreasury(issue, session),
    balance = await ledgerBalance(treasury.ledger._id, session);
  if (balance < amount) throw Object.assign(new Error(`Insufficient funds. Available balance is ${balance}.`), { statusCode: 409 });

  const payableAccount = await resolveAccountingAccount({
    tenantId: tenantId || issue.tenantId || due?.tenantId,
    settingsField: "payableAccount",
    fallbackCode: "2000",
    session,
  }).catch(() => null);

  const clearing = payableAccount || (await resolveAccountingAccount({
    tenantId: tenantId || issue.tenantId || due?.tenantId,
    settingsField: "inventoryClearingAccount",
    fallbackCode: "2050",
    session,
  }));

  const paymentRef = await makeNumber(tenantId || issue?.tenantId || due?.tenantId, "purchase.payment", session);
  const [payment] = await PurchasePayment.create(
    [
      {
        paymentReference: paymentRef,
        issue: issue?._id || null,
        due: due?._id || null,
        purchaseOrder: issue?.purchaseOrder || due?.purchaseOrder || null,
        supplier: issue?.supplier || due?.supplier,
        amount,
        paymentDate: paymentDate || new Date(),
        accountType: treasury.type,
        cashAccount: treasury.type === "cash" ? treasury.id : null,
        bankAccount: treasury.type === "bank" ? treasury.id : null,
        bankCheckNumber: issue?.bankCheckNumber || reference || "",
        idempotencyKey,
        paidBy: userId,
      },
    ],
    opt(session)
  );

  const docRef = due?.dueReference || issue?.purchaseReference || reference || "Purchase Payment";
  const memoText = note ? `Purchase payment: ${note}` : `Purchase payment ${docRef}`;

  const journal = await createPostedJournal({
    tenantId: tenantId || issue.tenantId || due?.tenantId,
    date: paymentDate || new Date(),
    sourceType: "purchase_payment",
    sourceId: payment._id,
    reference: payment.paymentReference,
    memo: memoText,
    currency: "BDT",
    voucherType: "payment",
    paymentMode: treasury.type,
    treasuryAccountType: treasury.type,
    cashAccount: treasury.type === "cash" ? treasury.id : null,
    bankAccount: treasury.type === "bank" ? treasury.id : null,
    userId,
    session,
    lines: [
      {
        account: clearing._id,
        debit: amount,
        credit: 0,
        description: docRef,
        contactType: "vendor",
        contactId: issue?.supplier || due?.supplier,
      },
      {
        account: treasury.ledger._id,
        debit: 0,
        credit: amount,
        description: treasury.name,
      },
    ],
  });

  payment.journalEntry = journal._id;
  await payment.save(opt(session));

  if (treasury.type === "bank") {
    await BankTransaction.create(
      [
        {
          bankAccount: treasury.id,
          kind: "withdrawal",
          direction: "out",
          amount,
          reference: payment.paymentReference,
          description: memoText,
          sourceType: "purchase_payment",
          journalEntry: journal._id,
          sourceId: payment._id,
          createdBy: userId,
          updatedBy: userId,
        },
      ],
      opt(session)
    );
  }

  return payment;
}
export async function finalizePurchaseIssue({issue,userId,session}){if(isFinalizedPurchaseIssue(issue))return issue;const product=issue.product?await Product.findById(issue.product).session(session):null;const order=new PurchaseOrder({orderNo:await makeNumber(issue.tenantId,"purchase.order",session),orderDate:new Date(),purchaseType:issue.purchaseType,purchaseReference:issue.purchaseReference,requestReference:issue.sourceRequestReference,purchaseIssue:issue._id,supplier:issue.supplier,currency:"BDT",paymentTermType:issue.paymentPlan,lines:[{product:product?._id||null,itemName:product?.name||issue.newItemName,productSnapshot:{code:product?.sku||"",name:product?.name||issue.newItemName},purchaseUnit:product?.baseUnit||null,orderedQuantity:issue.quantity,unitPrice:issue.unitPrice,discountType:issue.discountPercent>0?"percent":"none",discountValue:issue.discountPercent}],status:issue.purchaseType==="quick_purchase"?"approved":"draft",paidAmount:issue.paidAmount,dueAmount:issue.dueAmount,paymentPlan:issue.paymentPlan,paymentStatus:issue.paymentPlan==="after_quality_inspection"?"awaiting_inspection":issue.dueAmount>0?(issue.paidAmount>0?"partial":"unpaid"):"paid",qualityStatus:issue.purchaseType==="quick_purchase"?"not_required":"waiting",inventoryStatus:"not_ready",createdBy:userId,updatedBy:userId});await order.save(opt(session));issue.purchaseOrder=order._id;let due=null;if(issue.dueAmount>0||issue.paymentPlan==="after_quality_inspection"){[due]=await PurchaseDue.create([{dueReference:await makeNumber(issue.tenantId,"purchase.due",session),issue:issue._id,purchaseOrder:order._id,supplier:issue.supplier,product:issue.product,originalNetAmount:issue.netAmount,originallyPaidAmount:issue.paidAmount,currentPaidAmount:issue.paidAmount,remainingDue:issue.dueAmount||issue.netAmount,paymentDeadline:issue.paymentDeadline,paymentPlan:issue.paymentPlan,status:issue.paymentPlan==="after_quality_inspection"?"awaiting_inspection":issue.paidAmount>0?"partial":"outstanding",createdBy:userId,updatedBy:userId}],opt(session));issue.due=due._id;}if(issue.paidAmount>0)await postPurchasePayment({issue,amount:issue.paidAmount,userId,session,due,idempotencyKey:`ISSUE:${issue._id}:INITIAL`});if(issue.purchaseType==="quick_purchase"){const [pending]=await PendingInventory.create([{reference:makeRef("QP",issue._id),product:issue.product,quickProductName:issue.newItemName,acceptedQuantity:issue.quantity,remainingQuantity:issue.quantity,unitCost:issue.unitPrice,trackingType:product?.trackingType||"none",source:"quick_purchase",purchaseReference:issue.purchaseReference,purchaseId:order._id,createdBy:userId,updatedBy:userId}],opt(session));issue.pendingInventory=pending._id;order.inventoryStatus="pending_assignment";}issue.status="completed";issue.completedAt=new Date();issue.issuedBy=userId;await issue.save(opt(session));await order.save(opt(session));return issue;}
