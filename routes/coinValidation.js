'use strict';

/**
 * التحقق من العملات داخل النظام.
 *
 * هذا الملف مسؤول عن:
 * - التحقق من صحة قيمة العملات.
 * - منع القيم السالبة أو العشرية.
 * - منع تجاوز الحدود الآمنة.
 * - التحقق من الرصيد قبل الخصم.
 * - التحقق من أسعار الهدايا والغرف والمشتريات.
 * - التعامل مع مبالغ التحويل.
 *
 * لا يتم تعديل الرصيد من هذا الملف.
 * تعديل الرصيد يجب أن يتم داخل Transaction في walletService /
 * transactionService لضمان سلامة النظام.
 */

const MAX_SAFE_COIN_AMOUNT = Number.MAX_SAFE_INTEGER;

const DEFAULT_MAX_TRANSACTION_COINS = parsePositiveIntegerEnv(
  'MAX_TRANSACTION_COINS',
  1000000000
);

const DEFAULT_MIN_TRANSFER_COINS = parsePositiveIntegerEnv(
  'MIN_TRANSFER_COINS',
  1
);

const DEFAULT_MAX_TRANSFER_COINS = parsePositiveIntegerEnv(
  'MAX_TRANSFER_COINS',
  DEFAULT_MAX_TRANSACTION_COINS
);

const ROOM_PRICE_COINS = parsePositiveIntegerEnv(
  'ROOM_PRICE_COINS',
  50000
);

const MAX_GIFT_PRICE_COINS = parsePositiveIntegerEnv(
  'MAX_GIFT_PRICE_COINS',
  200000
);

const DAILY_REWARD_MIN_LEVEL = parsePositiveIntegerEnv(
  'DAILY_REWARD_MIN_LEVEL',
  5
);

function parsePositiveIntegerEnv(
  name,
  fallback
) {
  const value =
    Number.parseInt(
      process.env[name] || '',
      10
    );

  if (
    !Number.isSafeInteger(value) ||
    value <= 0
  ) {
    return fallback;
  }

  return value;
}

function createCoinValidationError(
  message,
  code = 'INVALID_COIN_AMOUNT',
  statusCode = 400
) {
  const error =
    new Error(message);

  error.code = code;
  error.statusCode = statusCode;

  return error;
}

function normalizeCoinAmount(
  value
) {
  if (
    typeof value === 'bigint'
  ) {
    if (
      value < 0n
    ) {
      throw createCoinValidationError(
        'قيمة العملات لا يمكن أن تكون سالبة.',
        'NEGATIVE_COIN_AMOUNT'
      );
    }

    if (
      value >
      BigInt(MAX_SAFE_COIN_AMOUNT)
    ) {
      throw createCoinValidationError(
        'قيمة العملات تتجاوز الحد المسموح.',
        'COIN_AMOUNT_TOO_LARGE'
      );
    }

    return Number(value);
  }

  if (
    typeof value === 'string'
  ) {
    const normalized =
      value.trim();

    if (
      !/^\d+$/.test(
        normalized
      )
    ) {
      throw createCoinValidationError(
        'قيمة العملات يجب أن تكون رقماً صحيحاً.',
        'INVALID_COIN_AMOUNT'
      );
    }

    const numberValue =
      Number(normalized);

    if (
      !Number.isSafeInteger(
        numberValue
      )
    ) {
      throw createCoinValidationError(
        'قيمة العملات تتجاوز الحد الآمن.',
        'COIN_AMOUNT_TOO_LARGE'
      );
    }

    return numberValue;
  }

  if (
    typeof value !== 'number'
  ) {
    throw createCoinValidationError(
      'قيمة العملات غير صالحة.',
      'INVALID_COIN_AMOUNT'
    );
  }

  if (
    !Number.isFinite(value)
  ) {
    throw createCoinValidationError(
      'قيمة العملات غير صالحة.',
      'INVALID_COIN_AMOUNT'
    );
  }

  if (
    !Number.isInteger(value)
  ) {
    throw createCoinValidationError(
      'العملات يجب أن تكون أرقاماً صحيحة بدون كسور.',
      'FRACTIONAL_COINS_NOT_ALLOWED'
    );
  }

  if (
    value < 0
  ) {
    throw createCoinValidationError(
      'قيمة العملات لا يمكن أن تكون سالبة.',
      'NEGATIVE_COIN_AMOUNT'
    );
  }

  if (
    !Number.isSafeInteger(value)
  ) {
    throw createCoinValidationError(
      'قيمة العملات تتجاوز الحد الآمن.',
      'COIN_AMOUNT_TOO_LARGE'
    );
  }

  return value;
}

function validateCoinAmount(
  value,
  options = {}
) {
  const {
    allowZero = false,
    min = null,
    max = null,
    fieldName = 'العملات'
  } = options;

  const amount =
    normalizeCoinAmount(
      value
    );

  if (
    !allowZero &&
    amount === 0
  ) {
    throw createCoinValidationError(
      `${fieldName} يجب أن تكون أكبر من صفر.`,
      'ZERO_COIN_AMOUNT'
    );
  }

  if (
    min !== null &&
    min !== undefined
  ) {
    const minimum =
      normalizeCoinAmount(
        min
      );

    if (
      amount < minimum
    ) {
      throw createCoinValidationError(
        `${fieldName} أقل من الحد الأدنى المسموح.`,
        'COIN_AMOUNT_BELOW_MINIMUM'
      );
    }
  }

  if (
    max !== null &&
    max !== undefined
  ) {
    const maximum =
      normalizeCoinAmount(
        max
      );

    if (
      amount > maximum
    ) {
      throw createCoinValidationError(
        `${fieldName} تتجاوز الحد الأقصى المسموح.`,
        'COIN_AMOUNT_ABOVE_MAXIMUM'
      );
    }
  }

  return amount;
}

function validateBalance(
  balance
) {
  return validateCoinAmount(
    balance,
    {
      allowZero: true,
      fieldName: 'الرصيد'
    }
  );
}

function hasEnoughCoins(
  balance,
  amount
) {
  const currentBalance =
    validateBalance(
      balance
    );

  const requiredAmount =
    validateCoinAmount(
      amount
    );

  return (
    currentBalance >=
    requiredAmount
  );
}

function assertEnoughCoins(
  balance,
  amount
) {
  const currentBalance =
    validateBalance(
      balance
    );

  const requiredAmount =
    validateCoinAmount(
      amount
    );

  if (
    currentBalance <
    requiredAmount
  ) {
    throw createCoinValidationError(
      'رصيد العملات غير كافٍ لإتمام العملية.',
      'INSUFFICIENT_COINS',
      400
    );
  }

  return {
    balance: currentBalance,
    amount: requiredAmount,
    remaining:
      currentBalance -
      requiredAmount
  };
}

function calculateRemainingBalance(
  balance,
  amount
) {
  const result =
    assertEnoughCoins(
      balance,
      amount
    );

  return result.remaining;
}

function validateTransferAmount(
  amount
) {
  return validateCoinAmount(
    amount,
    {
      min:
        DEFAULT_MIN_TRANSFER_COINS,
      max:
        DEFAULT_MAX_TRANSFER_COINS,
      fieldName: 'مبلغ التحويل'
    }
  );
}

function validatePurchaseAmount(
  amount
) {
  return validateCoinAmount(
    amount,
    {
      min: 1,
      max:
        DEFAULT_MAX_TRANSACTION_COINS,
      fieldName: 'مبلغ الشراء'
    }
  );
}

function validateGiftPrice(
  price
) {
  return validateCoinAmount(
    price,
    {
      min: 1,
      max:
        MAX_GIFT_PRICE_COINS,
      fieldName: 'سعر الهدية'
    }
  );
}

function validateRoomPrice(
  price
) {
  return validateCoinAmount(
    price,
    {
      min: 1,
      max:
        DEFAULT_MAX_TRANSACTION_COINS,
      fieldName: 'سعر الغرفة'
    }
  );
}

function isValidUserId(
  userId
) {
  if (
    userId === null ||
    userId === undefined
  ) {
    return false;
  }

  const value =
    String(userId).trim();

  if (!value) {
    return false;
  }

  return (
    /^[0-9a-fA-F-]{1,100}$/.test(
      value
    ) ||
    /^\d+$/.test(value)
  );
}

function validateUserId(
  userId,
  fieldName = 'معرف المستخدم'
) {
  if (
    !isValidUserId(
      userId
    )
  ) {
    throw createCoinValidationError(
      `${fieldName} غير صالح.`,
      'INVALID_USER_ID'
    );
  }

  return String(
    userId
  ).trim();
}

function validateDifferentUsers(
  senderId,
  receiverId
) {
  const sender =
    validateUserId(
      senderId,
      'معرف المرسل'
    );

  const receiver =
    validateUserId(
      receiverId,
      'معرف المستلم'
    );

  if (
    sender === receiver
  ) {
    throw createCoinValidationError(
      'لا يمكن تحويل العملات إلى نفس الحساب.',
      'SELF_TRANSFER_NOT_ALLOWED'
    );
  }

  return {
    senderId: sender,
    receiverId: receiver
  };
}

function validateTransactionAmount(
  amount,
  options = {}
) {
  const {
    fieldName =
      'مبلغ العملية',
    min = 1,
    max =
      DEFAULT_MAX_TRANSACTION_COINS
  } = options;

  return validateCoinAmount(
    amount,
    {
      min,
      max,
      fieldName
    }
  );
}

function validateDebit(
  balance,
  amount
) {
  const result =
    assertEnoughCoins(
      balance,
      amount
    );

  return {
    balance: result.balance,
    debit: result.amount,
    remaining:
      result.remaining
  };
}

function validateCredit(
  balance,
  amount
) {
  const currentBalance =
    validateBalance(
      balance
    );

  const creditAmount =
    validateTransactionAmount(
      amount,
      {
        fieldName:
          'مبلغ الإضافة'
      }
    );

  if (
    currentBalance >
    MAX_SAFE_COIN_AMOUNT -
      creditAmount
  ) {
    throw createCoinValidationError(
      'الرصيد الناتج يتجاوز الحد الآمن.',
      'BALANCE_OVERFLOW'
    );
  }

  return {
    balance:
      currentBalance,
    credit:
      creditAmount,
    resultingBalance:
      currentBalance +
      creditAmount
  };
}

function validateTransfer(
  senderId,
  receiverId,
  senderBalance,
  amount
) {
  const users =
    validateDifferentUsers(
      senderId,
      receiverId
    );

  const transferAmount =
    validateTransferAmount(
      amount
    );

  const debit =
    validateDebit(
      senderBalance,
      transferAmount
    );

  return {
    ...users,
    amount:
      transferAmount,
    senderBalance:
      debit.balance,
    senderRemaining:
      debit.remaining
  };
}

function validateCoinOperation(
  balance,
  amount,
  operation = 'debit'
) {
  const normalizedOperation =
    String(operation)
      .trim()
      .toLowerCase();

  if (
    normalizedOperation ===
    'debit'
  ) {
    return validateDebit(
      balance,
      amount
    );
  }

  if (
    normalizedOperation ===
    'credit'
  ) {
    return validateCredit(
      balance,
      amount
    );
  }

  throw createCoinValidationError(
    'نوع عملية العملات غير صالح.',
    'INVALID_COIN_OPERATION'
  );
}

function validateLevelReward(
  level,
  reward
) {
  const normalizedLevel =
    Number(level);

  if (
    !Number.isSafeInteger(
      normalizedLevel
    ) ||
    normalizedLevel < 1
  ) {
    throw createCoinValidationError(
      'مستوى المستخدم غير صالح.',
      'INVALID_LEVEL'
    );
  }

  const rewardAmount =
    validateCoinAmount(
      reward,
      {
        allowZero: true,
        fieldName:
          'مكافأة المستوى'
      }
    );

  return {
    level:
      normalizedLevel,
    reward:
      rewardAmount
  };
}

function canClaimDailyReward(
  level
) {
  const normalizedLevel =
    Number(level);

  if (
    !Number.isSafeInteger(
      normalizedLevel
    ) ||
    normalizedLevel < 1
  ) {
    return false;
  }

  return (
    normalizedLevel >=
    DAILY_REWARD_MIN_LEVEL
  );
}

function validateDailyReward(
  level,
  reward
) {
  if (
    !canClaimDailyReward(
      level
    )
  ) {
    throw createCoinValidationError(
      `المكافآت اليومية متاحة ابتداءً من المستوى ${DAILY_REWARD_MIN_LEVEL}.`,
      'DAILY_REWARD_LEVEL_REQUIRED'
    );
  }

  const rewardAmount =
    validateCoinAmount(
      reward,
      {
        allowZero: true,
        fieldName:
          'المكافأة اليومية'
      }
    );

  return {
    level:
      Number(level),
    reward:
      rewardAmount
  };
}

function validateRoomPurchase(
  balance,
  price = ROOM_PRICE_COINS
) {
  const roomPrice =
    validateRoomPrice(
      price
    );

  const debit =
    validateDebit(
      balance,
      roomPrice
    );

  return {
    price:
      roomPrice,
    balance:
      debit.balance,
    remaining:
      debit.remaining
  };
}

function validateGiftPurchase(
  balance,
  price
) {
  const giftPrice =
    validateGiftPrice(
      price
    );

  const debit =
    validateDebit(
      balance,
      giftPrice
    );

  return {
    price:
      giftPrice,
    balance:
      debit.balance,
    remaining:
      debit.remaining
  };
}

function validateWalletBalance(
  balance
) {
  return validateCoinAmount(
    balance,
    {
      allowZero: true,
      fieldName:
        'رصيد المحفظة'
    }
  );
}

function calculateTransferFee(
  amount,
  feePercent = 0,
  fixedFee = 0
) {
  const normalizedAmount =
    validateTransferAmount(
      amount
    );

  const percentage =
    Number(feePercent);

  const fixed =
    validateCoinAmount(
      fixedFee,
      {
        allowZero: true,
        fieldName:
          'الرسوم الثابتة'
      }
    );

  if (
    !Number.isFinite(
      percentage
    ) ||
    percentage < 0 ||
    percentage > 100
  ) {
    throw createCoinValidationError(
      'نسبة الرسوم غير صالحة.',
      'INVALID_FEE_PERCENT'
    );
  }

  const percentageFee =
    Math.ceil(
      normalizedAmount *
        (percentage / 100)
    );

  const totalFee =
    percentageFee +
    fixed;

  if (
    totalFee >
    normalizedAmount
  ) {
    throw createCoinValidationError(
      'الرسوم تتجاوز مبلغ العملية.',
      'FEE_EXCEEDS_AMOUNT'
    );
  }

  return {
    amount:
      normalizedAmount,
    percentageFee,
    fixedFee:
      fixed,
    totalFee,
    netAmount:
      normalizedAmount -
      totalFee
  };
}

function validateWalletAfterOperation(
  balance
) {
  return validateWalletBalance(
    balance
  );
}

module.exports = {
  MAX_SAFE_COIN_AMOUNT,
  DEFAULT_MAX_TRANSACTION_COINS,
  DEFAULT_MIN_TRANSFER_COINS,
  DEFAULT_MAX_TRANSFER_COINS,
  ROOM_PRICE_COINS,
  MAX_GIFT_PRICE_COINS,
  DAILY_REWARD_MIN_LEVEL,

  createCoinValidationError,

  normalizeCoinAmount,
  validateCoinAmount,
  validateBalance,

  hasEnoughCoins,
  assertEnoughCoins,
  calculateRemainingBalance,

  validateTransferAmount,
  validatePurchaseAmount,
  validateGiftPrice,
  validateRoomPrice,
  validateTransactionAmount,

  isValidUserId,
  validateUserId,
  validateDifferentUsers,

  validateDebit,
  validateCredit,
  validateTransfer,
  validateCoinOperation,

  validateLevelReward,
  canClaimDailyReward,
  validateDailyReward,

  validateRoomPurchase,
  validateGiftPurchase,

  validateWalletBalance,
  validateWalletAfterOperation,

  calculateTransferFee
};
