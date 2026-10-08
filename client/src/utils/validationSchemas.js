import * as yup from 'yup';

const passwordRules = yup
  .string()
  .required('Password is required')
  .min(8, 'Password must be at least 8 characters')
  .matches(/[A-Z]/, 'Include at least one uppercase letter')
  .matches(/[a-z]/, 'Include at least one lowercase letter')
  .matches(/[0-9]/, 'Include at least one number');

export const loginSchema = yup.object({
  email: yup.string().trim().email('Enter a valid email').required('Email is required'),
  password: yup.string().required('Password is required'),
});

export const registerSchema = yup.object({
  name: yup.string().trim().min(2, 'Enter your full name').required('Name is required'),
  email: yup.string().trim().email('Enter a valid email').required('Email is required'),
  phone: yup.string().trim().matches(/^[0-9]{10,15}$/, 'Enter a valid phone number').required('Phone number is required'),
  address: yup.string().trim().required('Address is required'),
  password: passwordRules,
  confirmPassword: yup.string()
    .oneOf([yup.ref('password')], 'Passwords must match')
    .required('Confirm your password'),
});

export const forgotPasswordSchema = yup.object({
  email: yup.string().trim().email('Enter a valid email').required('Email is required'),
});

export const resetPasswordSchema = yup.object({
  password: passwordRules,
  confirmPassword: yup.string()
    .oneOf([yup.ref('password')], 'Passwords must match')
    .required('Confirm your password'),
});

export const changePasswordSchema = yup.object({
  currentPassword: yup.string().required('Current password is required'),
  newPassword: passwordRules,
  confirmPassword: yup.string()
    .oneOf([yup.ref('newPassword')], 'Passwords must match')
    .required('Confirm your new password'),
});

export const complaintSchema = yup.object({
  title: yup.string().trim().max(150, 'Case title must be under 150 characters'),
  categoryId: yup.string().required('Select a complaint category'),
  sellerName: yup.string().trim().required('Seller / trader name is required'),
  oppositePartyName: yup.string().trim().required('Opposite party name is required'),
  oppositePartyAddress: yup.string().trim(),
  oppositePartyEmail: yup.string().trim().email('Enter a valid e-mail address'),
  oppositePartyPhone: yup.string().trim().matches(/^$|^[0-9+\-\s]{7,15}$/, 'Enter a valid phone number'),
  product: yup.string().trim(),
  service: yup.string().trim(),
  purchaseDate: yup.string(),
  invoiceNumber: yup.string().trim(),
  complaintAmount: yup
    .number()
    .typeError('Enter a valid amount')
    .positive('Amount must be greater than zero')
    .required('Complaint amount is required'),
  description: yup
    .string()
    .trim()
    .min(20, 'Please provide at least 20 characters describing your complaint')
    .required('Description is required'),
});
