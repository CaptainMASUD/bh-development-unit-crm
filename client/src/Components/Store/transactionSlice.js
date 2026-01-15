import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export const createSale = createAsyncThunk(
  'transactions/createSale',
  async (saleData) => {
    const response = await fetch('http://localhost:4000/api/sales/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(saleData),
    });
    if (!response.ok) {
      throw new Error('Failed to create sale');
    }
    return response.json();
  }
);

const transactionSlice = createSlice({
  name: 'transactions',
  initialState: {
    currentTransaction: null,
    dailySales: [],
    status: 'idle',
    error: null,
  },
  reducers: {
    setCurrentTransaction: (state, action) => {
      state.currentTransaction = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createSale.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(createSale.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.dailySales.push(action.payload.newSale);
        state.currentTransaction = action.payload.newSale;
      })
      .addCase(createSale.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message;
      });
  },
});

export const { setCurrentTransaction } = transactionSlice.actions;

export default transactionSlice.reducer;
