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
  caseType: yup.string().oneOf(['NEW_COMPLAINT', 'APPEAL']).default('NEW_COMPLAINT'),
  categoryId: yup.string().required('Select a complaint category'),
  sellerName: yup.string().trim().when('caseType', {
    is: 'APPEAL',
    then: (schema) => schema.notRequired(),
    otherwise: (schema) => schema.required('Seller / trader name is required'),
  }),
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
    .required('Claim / dispute amount is required')
    .when('caseType', {
      is: 'APPEAL',
      then: (schema) => schema.positive('Amount in dispute must be greater than zero'),
      otherwise: (schema) => schema
        .moreThan(5000000, 'Claims up to ₹50,00,000 are filed with the District Commission, not the State Commission.')
        .max(20000000, 'Claims above ₹2,00,00,000 are filed with the National Commission.'),
    }),
  description: yup
    .string()
    .trim()
    .min(20, 'Please provide at least 20 characters describing your complaint')
    .required('Description is required'),
  
  // Appeal fields
  districtCaseNumber: yup.string().trim().when('caseType', {
    is: 'APPEAL',
    then: (schema) => schema.required('District case number is required'),
    otherwise: (schema) => schema.notRequired(),
  }),
  districtCommissionName: yup.string().trim().when('caseType', {
    is: 'APPEAL',
    then: (schema) => schema.required('District Commission name is required'),
    otherwise: (schema) => schema.notRequired(),
  }),
  districtOrderDate: yup.string().when('caseType', {
    is: 'APPEAL',
    then: (schema) => schema
      .required('District order date is required')
      .test('not-in-future', 'District order date cannot be in the future', (val) => {
        if (!val) return false;
        return new Date(val) <= new Date();
      }),
    otherwise: (schema) => schema.notRequired(),
  }),
  appealGrounds: yup.string().trim().when('caseType', {
    is: 'APPEAL',
    then: (schema) => schema
      .min(50, 'Grounds of appeal must be at least 50 characters')
      .required('Grounds of appeal are required'),
    otherwise: (schema) => schema.notRequired(),
  }),
});
