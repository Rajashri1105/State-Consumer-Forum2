import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import notificationReducer from './slices/notificationSlice';
import uiReducer from './slices/uiSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    notifications: notificationReducer,
    ui: uiReducer,
  },
});
