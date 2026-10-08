import { createSlice } from '@reduxjs/toolkit';

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    sidebarCollapsed: false,
  },
  reducers: {
    toggleSidebar(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
  },
});

export const { toggleSidebar } = uiSlice.actions;
export default uiSlice.reducer;
