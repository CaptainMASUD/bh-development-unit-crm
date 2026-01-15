import { createSlice, createAsyncThunk } from "@reduxjs/toolkit"

export const login = createAsyncThunk("user/login", async (credentials) => {
  // Implement login logic here
  // For now, we'll just return a mock user
  return { id: 1, name: "John Doe", role: "cashier" }
})

export const logout = createAsyncThunk("user/logout", async () => {
  // Implement logout logic here
})

export const changePassword = createAsyncThunk("user/changePassword", async (newPassword) => {
  // Implement change password logic here
  // For now, we'll just return a success message
  return { message: "Password changed successfully" }
})

const userSlice = createSlice({
  name: "user",
  initialState: {
    currentUser: null,
    status: "idle",
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.status = "loading"
      })
      .addCase(login.fulfilled, (state, action) => {
        state.status = "succeeded"
        state.currentUser = action.payload
      })
      .addCase(login.rejected, (state, action) => {
        state.status = "failed"
        state.error = action.error.message
      })
      .addCase(logout.fulfilled, (state) => {
        state.currentUser = null
      })
      .addCase(changePassword.fulfilled, (state, action) => {
        state.status = "succeeded"
        // You might want to update the user state here if needed
      })
  },
})

export default userSlice.reducer

