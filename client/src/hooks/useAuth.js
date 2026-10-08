import { useSelector, useDispatch } from 'react-redux';
import { useCallback } from 'react';
import { logoutUser } from '../redux/slices/authSlice';

export function useAuth() {
  const dispatch = useDispatch();
  const { user, judgeProfile, status, error, bootstrapped } = useSelector((state) => state.auth);

  const logout = useCallback(() => dispatch(logoutUser()), [dispatch]);

  return {
    user,
    judgeProfile,
    isAuthenticated: Boolean(user),
    role: user?.role,
    status,
    error,
    bootstrapped,
    logout,
  };
}
