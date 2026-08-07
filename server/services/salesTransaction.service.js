import mongoose from "mongoose";

let transactionSupport;

const supportsTransactions = async () => {
  if (transactionSupport !== undefined) return transactionSupport;
  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    transactionSupport = Boolean(hello?.setName || hello?.msg === "isdbgrid");
  } catch {
    transactionSupport = false;
  }
  return transactionSupport;
};

export const runSalesTransaction = async (work) => {
  if (!(await supportsTransactions())) return work(null);

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
};
