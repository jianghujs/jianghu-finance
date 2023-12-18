module.exports = {
  tableEnum: {
    // ========================江湖表============================
    _cache: '_cache',
    _constant: '_constant',
    _file: '_file',
    _group: '_group',
    _log: '_log',
    _page: '_page',
    _resource: '_resource',
    _record_history: '_record_history',
    _resource_request_log: '_resource_request_log',
    _role: '_role',
    _test_case: '_test_case',
    _user: '_user',
    _user_group_role: '_user_group_role',
    _user_group_role_page: '_user_group_role_page',
    _user_group_role_resource: '_user_group_role_resource',
    _user_group_role_ui_level: '_user_group_role_ui_level',
    _user_session: '_user_session',
    _app_account: '_app_account',
    // ========================应用表============================

    period: 'period',
    voucher: 'voucher',
    voucher_entry: 'voucher_entry',
    voucher_template: 'voucher_template',
    subject: 'subject',
    subject_balance_start: 'subject_balance_start',
    subject_balance_period: 'subject_balance_period',
    subject_balance_year: 'subject_balance_year',
    subject_balance_year_adjust: 'subject_balance_year_adjust',

    report_asset_liability_formula: 'report_asset_liability_formula',
    report_asset_liability_item: 'report_asset_liability_item',
    report_profit_formula: 'report_profit_formula',
    report_profit_item: 'report_profit_item',

    report_cash_flow_item: 'report_cash_flow_item',
    report_cash_flow_item2: 'report_cash_flow_item2',
    report_cash_flow_item2_period: 'report_cash_flow_item2_period',
    report_cash_flow_item3: 'report_cash_flow_item3',
    report_cash_flow_ex_formula: 'report_cash_flow_ex_formula',
    report_cash_flow_ex_item: 'report_cash_flow_ex_item',

    report_summary_item: 'report_summary_item',



    assist_customer: 'assist_customer',
    assist_depart: 'assist_depart',
    assist_project: 'assist_project',
    assist_staff: 'assist_staff',
    assist_supplier: 'assist_supplier',
    assist_cash_flow: 'assist_cash_flow',

    fund_account: 'fund_account',
    fund_account_entry: 'fund_account_entry',
    fund_account_transfer_entry: 'fund_account_transfer_entry',

    invoice: 'invoice',
    invoice_entry: 'invoice_entry',

    employee: 'employee',
    salary_record: 'salary_record',
    salary_month_record: 'salary_month_record',
    currency: 'currency',

    // ========================高级 View============================
    view01_invoice: 'view01_invoice',

    view01_voucher_entry: 'view01_voucher_entry',
    view01_subject_balance_year: 'view01_subject_balance_year',
    view01_subject_balance_period: 'view01_subject_balance_period',

    view01_report_asset_liability_item: 'view01_report_asset_liability_item',
    view02_report_asset_liability_formula: 'view02_report_asset_liability_formula',

    view01_report_profit_item: 'view01_report_profit_item',
    view02_report_profit_formula: 'view02_report_profit_formula',

    view01_report_cash_flow_ex_item: 'view01_report_cash_flow_ex_item',
    view02_report_cash_flow_ex_formula: 'view02_report_cash_flow_ex_formula',

    view01_voucher_entry: 'view01_voucher_entry',

    view01_subject_balance_start: 'view01_subject_balance_start',
  },
  subjectCategoryEnum: {
    zhican: '资产',
    fuzai: '负债',
    quanyi: '权益',
    chengben: '成本',
    sunyi: '损益',
  }
}
