import { createSlice, createAsyncThunk } from "@reduxjs/toolkit"

export const fetchDailySales = createAsyncThunk("sales/fetchDailySales", async () => {
  const response = await fetch("http://localhost:4000/api/sales/")
  if (!response.ok) {
    throw new Error("Failed to fetch sales data")
  }
  return response.json()
})

export const createSale = createAsyncThunk("sales/createSale", async (saleData) => {
  const response = await fetch("http://localhost:4000/api/sales/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(saleData),
  })
  if (!response.ok) {
    throw new Error("Failed to create sale")
  }
  return response.json()
})

const salesSlice = createSlice({
  name: "sales",
  initialState: {
    dailySales: [],
    currentSale: null,
    status: "idle",
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDailySales.pending, (state) => {
        state.status = "loading"
      })
      .addCase(fetchDailySales.fulfilled, (state, action) => {
        state.status = "succeeded"
        state.dailySales = action.payload
      })
      .addCase(fetchDailySales.rejected, (state, action) => {
        state.status = "failed"
        state.error = action.error.message
      })
      .addCase(createSale.fulfilled, (state, action) => {
        state.dailySales.push(action.payload)
        state.currentSale = action.payload
      })
  },
})

export default salesSlice.reducer

