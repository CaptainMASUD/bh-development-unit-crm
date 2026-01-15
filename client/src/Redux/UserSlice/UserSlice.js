import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    currentUser: null,
    error: null,
    loading: null
};

const userSlice = createSlice({
    name: "user",
    initialState,
    reducers: {
        signInStart: (state) => {
            state.loading = true;
            state.error = null;
        },
        signInSuccess: (state, action) => {
            state.currentUser = action.payload;
            state.loading = false;
            state.error = null;
        },
        signInError: (state, action) => {
            state.loading = false;
            state.error = action.payload;
        },
        signOut: (state) => {
            state.currentUser = null;  // Clear user data
            state.loading = false;
            state.error = null;
        }
    }
});

export const { signInStart, signInSuccess, signInError, signOut } = userSlice.actions;
export default userSlice.reducer;



