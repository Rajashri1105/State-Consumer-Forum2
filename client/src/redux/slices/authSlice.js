import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authService } from '../../services/authService';
import { setAccessToken } from '../../services/api';

export const loginUser = createAsyncThunk('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    const { data } = await authService.login(credentials);
    setAccessToken(data.data.accessToken);
    return data.data.user;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Login failed');
  }
});

export const registerUser = createAsyncThunk('auth/register', async (payload, { rejectWithValue }) => {
  try {
    const { data } = await authService.register(payload);
    return data.data.user;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Registration failed');
  }
});

export const fetchCurrentUser = createAsyncThunk('auth/fetchMe', async (_, { rejectWithValue }) => {
  try {
    const { data } = await authService.getMe();
    return { user: data.data.user, judgeProfile: data.data.judgeProfile };
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Session expired');
  }
});

export const logoutUser = createAsyncThunk('auth/logout', async () => {
  try {
    await authService.logout();
  } finally {
    setAccessToken(null);
  }
});

export const bootstrapSession = createAsyncThunk('auth/bootstrap', async (_, { rejectWithValue }) => {
  // On app load there's no access token yet — attempt a silent refresh
  // using the httpOnly cookie, then fetch the profile if it succeeds.
  try {
    const { data } = await authService.refresh();
    setAccessToken(data.data.accessToken);
    return data.data.user;
  } catch (err) {
    return rejectWithValue(null);
  }
});

const initialState = {
  user: null,
  judgeProfile: null,
  status: 'idle', // idle | loading | succeeded | failed
  bootstrapped: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearAuthError(state) {
      state.error = null;
    },
    setUser(state, action) {
      state.user = { ...state.user, ...action.payload };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => { state.status = 'loading'; state.error = null; })
      .addCase(loginUser.fulfilled, (state, action) => { state.status = 'succeeded'; state.user = action.payload; })
      .addCase(loginUser.rejected, (state, action) => { state.status = 'failed'; state.error = action.payload; })

      .addCase(registerUser.pending, (state) => { state.status = 'loading'; state.error = null; })
      .addCase(registerUser.fulfilled, (state) => { state.status = 'succeeded'; })
      .addCase(registerUser.rejected, (state, action) => { state.status = 'failed'; state.error = action.payload; })

      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.judgeProfile = action.payload.judgeProfile;
      })
      .addCase(fetchCurrentUser.rejected, (state) => {
        state.user = null;
      })

      .addCase(bootstrapSession.fulfilled, (state, action) => {
        state.user = action.payload;
        state.bootstrapped = true;
      })
      .addCase(bootstrapSession.rejected, (state) => {
        state.user = null;
        state.bootstrapped = true;
      })

      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.judgeProfile = null;
        state.status = 'idle';
      });
  },
});

export const { clearAuthError, setUser } = authSlice.actions;
export default authSlice.reducer;
