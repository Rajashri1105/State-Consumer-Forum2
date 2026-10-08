import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { notificationService } from '../../services/judgmentAndNotificationService';

export const fetchUnreadCount = createAsyncThunk('notifications/unreadCount', async () => {
  const { data } = await notificationService.unreadCount();
  return data.data.count;
});

export const fetchNotifications = createAsyncThunk('notifications/list', async (params) => {
  const { data } = await notificationService.list(params);
  return data.data;
});

export const markNotificationRead = createAsyncThunk('notifications/markRead', async (id) => {
  await notificationService.markRead(id);
  return id;
});

export const markAllNotificationsRead = createAsyncThunk('notifications/markAllRead', async () => {
  await notificationService.markAllRead();
});

const notificationSlice = createSlice({
  name: 'notifications',
  initialState: {
    items: [],
    unreadCount: 0,
    status: 'idle',
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUnreadCount.fulfilled, (state, action) => { state.unreadCount = action.payload; })
      .addCase(fetchNotifications.pending, (state) => { state.status = 'loading'; })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload.items;
      })
      .addCase(markNotificationRead.fulfilled, (state, action) => {
        const item = state.items.find((n) => n.id === action.payload);
        if (item) item.isRead = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      })
      .addCase(markAllNotificationsRead.fulfilled, (state) => {
        state.items.forEach((n) => { n.isRead = true; });
        state.unreadCount = 0;
      });
  },
});

export default notificationSlice.reducer;
