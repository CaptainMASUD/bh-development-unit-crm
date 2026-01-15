import { createSlice } from '@reduxjs/toolkit';

const cartSlice = createSlice({
  name: 'cart',
  initialState: {
    items: [],
    globalDiscount: 0,
  },
  reducers: {
    addToCart: (state, action) => {
      const existingItem = state.items.find(item => item._id === action.payload._id);
      if (existingItem) {
        existingItem.qty += 1;
        existingItem.total = existingItem.qty * existingItem.sellPrice;
      } else {
        state.items.push({ ...action.payload, qty: 1, total: action.payload.sellPrice, discount: 0 });
      }
    },
    updateCartItemQuantity: (state, action) => {
      const { id, newQty } = action.payload;
      const item = state.items.find(item => item._id === id);
      if (item) {
        item.qty = Math.max(1, newQty);
        item.total = item.qty * item.sellPrice;
      }
    },
    updateCartItemDiscount: (state, action) => {
      const { id, newDiscount } = action.payload;
      const item = state.items.find(item => item._id === id);
      if (item) {
        item.discount = Math.max(0, newDiscount);
      }
    },
    removeCartItem: (state, action) => {
      state.items = state.items.filter(item => item._id !== action.payload);
    },
    updateGlobalDiscount: (state, action) => {
      state.globalDiscount = action.payload;
    },
    clearCart: (state) => {
      state.items = [];
      state.globalDiscount = 0;
    },
  },
});

export const { 
  addToCart, 
  updateCartItemQuantity, 
  updateCartItemDiscount, 
  removeCartItem, 
  updateGlobalDiscount, 
  clearCart 
} = cartSlice.actions;

export default cartSlice.reducer;
