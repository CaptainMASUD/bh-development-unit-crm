import {createSlice} from '@reduxjs/toolkit'

const initialState = {
    theme : 'light'
}

const themeSlice = createSlice({
    name : 'theme',
    initialState,
    reducers :{
        tougleTheme : (state)=>{
            state.theme = state.theme === 'light' ? 'dark' : "light"
        }
    }
})

export const {tougleTheme} = themeSlice.actions

export default themeSlice.reducer