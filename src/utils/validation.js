const Joi = require('joi');

const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

const baseEmailValidation = Joi.string()
  .email({ tlds: { allow: false } })
  .required()
  .trim()
  .lowercase()
  .max(254);

const basePasswordValidation = Joi.string()
  .min(8)
  .max(128)
  .pattern(passwordPattern)
  .required();

const registerSchema = Joi.object({
  email: baseEmailValidation,
  password: basePasswordValidation,
});

const loginSchema = Joi.object({
  email: baseEmailValidation,
  password: Joi.string().required(),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: basePasswordValidation,
});

const updateEmailSchema = Joi.object({
  email: baseEmailValidation,
  password: Joi.string().required(),
});

const forgotPasswordSchema = Joi.object({
  email: baseEmailValidation,
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  password: basePasswordValidation,
});

const createGroupValidation = Joi.object({
  name: Joi.string().min(2).max(50).required().trim(),
  description: Joi.string().max(500).optional().allow('').trim(),
  type: Joi.string().valid('public', 'private').optional().default('public'),
  memberLimit: Joi.number().integer().min(2).max(1000).optional().default(100),
});

const updateGroupValidation = Joi.object({
  name: Joi.string().min(2).max(50).optional().trim(),
  description: Joi.string().max(500).optional().allow('').trim(),
  memberLimit: Joi.number().integer().min(2).max(1000).optional(),
});

const memberActionValidation = Joi.object({
  action: Joi.string().valid('approve', 'reject', 'ban', 'unban').required(),
  reason: Joi.string().max(200).optional().allow('').trim(),
});

const sendMessageValidation = Joi.object({
  content: Joi.string().min(1).max(2000).required().trim(),
  clientId: Joi.string().max(100).optional().trim(),
  replyTo: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional(),
});

const messageSearchValidation = Joi.object({
  q: Joi.string().min(2).max(100).required().trim(),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
});

function validateData(data, schema) {
  const result = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });

  return {
    error: result.error,
    value: result.value,
    isValid: !result.error,
  };
}

function createValidationMiddleware(schema, property = 'body') {
  return (req, res, next) => {
    const dataToValidate = req[property];
    const { error, value, isValid } = validateData(dataToValidate, schema);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
        })),
      });
    }

    req[property] = value;
    next();
  };
}

function validateRegistration(data) {
  return validateData(data, registerSchema);
}

function validateLogin(data) {
  return validateData(data, loginSchema);
}

function validateGroupCreation(data) {
  return validateData(data, createGroupValidation);
}

function validateGroupUpdate(data) {
  return validateData(data, updateGroupValidation);
}

function validateMemberAction(data) {
  return validateData(data, memberActionValidation);
}

function validateSendMessage(data) {
  return validateData(data, sendMessageValidation);
}

function validateMessageSearch(data) {
  return validateData(data, messageSearchValidation);
}

module.exports = {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  updateEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  createGroupValidation,
  updateGroupValidation,
  memberActionValidation,
  sendMessageValidation,
  messageSearchValidation,
  validateData,
  createValidationMiddleware,
  validateRegistration,
  validateLogin,
  validateGroupCreation,
  validateGroupUpdate,
  validateMemberAction,
  validateSendMessage,
  validateMessageSearch,
};
