'use strict';

class BizError extends Error {
  constructor({ errorCode, errorReason, errorReasonSupplement }) {
    super(JSON.stringify({ errorCode, errorReason, errorReasonSupplement }));
    this.name = 'BizError';
    this.errorCode = errorCode;
    this.errorReason = errorReason;
    this.errorReasonSupplement = errorReasonSupplement;
  }
}

const errorInfoEnum = Object.freeze({
  data_exception: {
    errorCode: "data_expection",
    errorReason: "数据异常",
  },
  disable_edit_appaId: {
    errorCode: "disable_edit_appaId",
    errorReason: "禁止操作的帐套",
  },
  not_support_appaStandard: {
    errorCode: "not_support_appaStandard",
    errorReason: "不支持的会计准则",
  },
  jianghuKnex_appaId_error: {
    errorCode: "jianghuKnex_appaId_error",
    errorReason: "请选择账套",
  },
  resource_not_support: {
    errorCode: 'resource_not_support',
    errorReason: '协议不支持',
  },
  subject_not_exist: {
    errorCode: "subject_not_exist",
    errorReason: "科目不存在",
  },
  subject_can_not_be_remove: {
    errorCode: "subject_can_not_be_remove",
    errorReason: "科目不能被删除",
  },
  subject_has_voucher_entry: {
    errorCode: "subject_has_voucher_entry",
    errorReason: "该科目有凭证正在使用",
  },
  subject_report_formula: {
    errorCode: "subject_report_formula",
    errorReason: "该科目有报表公式正在使用",
  },
  subject_has_report_formula: {
    errorCode: "subject_has_report_formula",
    errorReason: "该科目有报表公式正在使用",
  },
  voucher_not_exist: {
    errorCode: "voucher_not_exist",
    errorReason: "凭证不存在",
  },
  period_not_exist: {
    errorCode: "period_not_exist",
    errorReason: "会计期间不存在",
  },
  period_has_template_voucher: {
    errorCode: "period_has_template_voucher",
    errorReason: "请先删除会计期间的结转凭证",
  },
  pre_period_not_exist: {
    errorCode: "pre_period_not_exist",
    errorReason: "上一个会计期间不存在",
  },
  period_has_checkout: {
    errorCode: "period_has_checkout",
    errorReason: "会计期间已结账",
  },
  voucherId_exist: {
    errorCode: "voucherId_exist",
    errorReason: "凭证字号已存在",
  },
  invoice_entry_list_must_has_data: {
    errorCode: "invoice_entry_list_must_has_data",
    errorReason: "发票数据不能为空",
  },
  invoice_entry_id_not_exist: {
    errorCode: "invoice_entry_id_not_exist",
    errorReason: "发票ID不存在",
  },
  salary_entry_id_not_exist: {
    errorCode: "salary_entry_id_not_exist",
    errorReason: "工资ID不存在",
  },
  salary_entry_import_data_is_empty: {
    errorCode: "salary_entry_import_data_is_empty",
    errorReason: "导入数据为空",
  },
  invoice_entry_not_exist: {
    errorCode: "invoice_entry_not_exist",
    errorReason: "发票不存在",
  },
  salary_entry_not_exist: {
    errorCode: "salary_entry_not_exist",
    errorReason: "工资条不存在",
  },
  not_admin: {
    errorCode: "not_admin",
    errorReason: "非管理员",
  },
  user_not_appa_manager: {
    errorCode: "user_not_appa_manager",
    errorReason: "非帐套管理员",
  },
});

module.exports = {
  BizError,
  errorInfoEnum,
};
