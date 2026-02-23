function validateAgainstFormSchema(payload, formSchema) {
  if (!isPlainObject(formSchema) || Object.keys(formSchema).length === 0) {
    return { success: true };
  }

  const fieldErrors = {};

  for (const [field, rawRules] of Object.entries(formSchema)) {
    if (!isPlainObject(rawRules)) {
      continue;
    }

    const rules = rawRules;
    const hasField = Object.prototype.hasOwnProperty.call(payload, field);

    if (rules.required === true && !hasField) {
      addFieldError(fieldErrors, field, 'Required field is missing.');
      continue;
    }

    if (!hasField) {
      continue;
    }

    const value = payload[field];
    const valueType = inferType(value);

    if (typeof rules.type === 'string' && valueType !== rules.type) {
      addFieldError(fieldErrors, field, `Expected ${rules.type}.`);
      continue;
    }

    if (typeof rules.minLength === 'number' && typeof value === 'string' && value.length < rules.minLength) {
      addFieldError(fieldErrors, field, `Must be at least ${rules.minLength} characters.`);
    }

    if (typeof rules.maxLength === 'number' && typeof value === 'string' && value.length > rules.maxLength) {
      addFieldError(fieldErrors, field, `Must be at most ${rules.maxLength} characters.`);
    }

    if (typeof rules.minimum === 'number' && typeof value === 'number' && value < rules.minimum) {
      addFieldError(fieldErrors, field, `Must be >= ${rules.minimum}.`);
    }

    if (typeof rules.maximum === 'number' && typeof value === 'number' && value > rules.maximum) {
      addFieldError(fieldErrors, field, `Must be <= ${rules.maximum}.`);
    }

    if (Array.isArray(rules.enum) && rules.enum.length > 0 && !rules.enum.includes(value)) {
      addFieldError(fieldErrors, field, 'Value is not in allowed set.');
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: {
        formErrors: [],
        fieldErrors
      }
    };
  }

  return { success: true };
}

function inferType(value) {
  if (value === null) {
    return 'null';
  }

  return typeof value;
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function addFieldError(fieldErrors, field, message) {
  if (!fieldErrors[field]) {
    fieldErrors[field] = [];
  }

  fieldErrors[field].push(message);
}

module.exports = {
  validateAgainstFormSchema
};
