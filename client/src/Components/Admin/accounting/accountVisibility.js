export function isBankManagedAccount(account) {
  const code = String(account?.code || "").trim().toUpperCase()
  const description = String(account?.description || "").trim().toLowerCase()

  return (
    account?.isBankManaged === true ||
    code === "1010" ||
    code.startsWith("BANK-") ||
    description.startsWith("linked bank ledger for account")
  )
}

export function excludeBankManagedAccounts(
  accounts = [],
  { includeDefaultBank = false } = {},
) {
  return accounts.filter((account) => {
    const code = String(account?.code || "").trim().toUpperCase()
    if (includeDefaultBank && code === "1010") return true
    return !isBankManagedAccount(account)
  })
}

export function getOpeningBalanceAccounts(accounts = []) {
  const activeParentIds = new Set(
    accounts
      .filter((account) => account?.isActive !== false)
      .map((account) => account?.parent?._id || account?.parent)
      .filter(Boolean)
      .map(String),
  )

  return excludeBankManagedAccounts(accounts, { includeDefaultBank: true }).filter(
    (account) =>
      account?.isActive !== false &&
      account?.isGroup !== true &&
      Boolean(account?.publishedAt) &&
      account?.hasActiveChildren !== true &&
      !activeParentIds.has(String(account?._id || "")),
  )
}
