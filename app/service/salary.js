const Service = require('egg').Service;
const validateUtil = require('@jianghujs/jianghu/app/common/validateUtil');
const {tableEnum} = require('../constant/constant');
const _ = require('lodash');
const dayjs = require('dayjs');
const {errorInfoEnum, BizError} = require('../constant/error');

const actionDataScheme = Object.freeze({});

class SalaryService extends Service {
  async createListFromEmployee() {
    const { jianghuKnex } = this.app;
    const {where} = this.ctx.request.body.appData;
    const salaryRecordList = await jianghuKnex(tableEnum.salary_record, this.ctx).where(where).select('employeeId');
    const employeeList = await jianghuKnex(tableEnum.employee, this.ctx).whereNotIn('employeeId', salaryRecordList).select();
    if (employeeList.length) {
      await jianghuKnex.transaction(async trx => {
        const customSalarySubject = await trx(tableEnum._constant, this.ctx).where({constantKey: 'customSalarySubject'}).first();
        const customSalarySubjectValue = JSON.parse(customSalarySubject.constantValue);

        let salaryMonthRecordId = await trx(tableEnum.salary_month_record, this.ctx).where(where).first('salaryMonthRecordId');
        if(!salaryMonthRecordId) {
          salaryMonthRecordId = `${where.year}-${where.month}`;
          const salaryMonthRecord = {
            salaryMonthRecordId,
            year: where.year,
            month: where.month,
          }
          await trx(tableEnum.salary_month_record, this.ctx).insert(salaryMonthRecord);
        }

        for (const employeeListElement of employeeList) {
          const insuranceConfig = JSON.parse(employeeListElement.insuranceConfig);
          const salaryRecord = {
            salaryRecordId: `${employeeListElement.employeeId}-${dayjs().format('YYYY-MM')}`,
            salaryMonthRecordId,
            employeeId: employeeListElement.employeeId,
            year: where.year,
            month: where.month,
            taxExemption: 5000,
            totalSalaryContent: JSON.stringify(customSalarySubjectValue.totalSalaryContent),
            totalDeductSalaryContent: JSON.stringify(customSalarySubjectValue.totalDeductSalaryContent),
            realPaySalaryAdjustmentContent: JSON.stringify(customSalarySubjectValue.realPaySalaryAdjustmentContent),
            // {
            // "endowmentInsurance":{"name":"养老保险","paymentBase":5554,"personalRatio":8,"companyRatio":20,"personalPay":"444.32","companyPay":"1110.80"},
            // "medicalInsurance":{"name":"医疗保险","paymentBase":5554,"personalRatio":2,"companyRatio":10,"personalPay":"111.08","companyPay":"555.40"},
            // "unemploymentInsurance":{"name":"失业保险","paymentBase":4443,"personalRatio":0.2,"companyRatio":1,"personalPay":"8.89","companyPay":"44.43"},
            // "injuryInsurance":{"name":"工伤保险","paymentBase":5554,"personalRatio":0,"companyRatio":0.5,"personalPay":"0.00","companyPay":"27.77"},
            // "maternityInsurance":{"name":"生育保险","paymentBase":4444,"personalRatio":0,"companyRatio":0.8,"personalPay":"0.00","companyPay":"35.55"},
            // "housingFund":{"name":"住房公积金","paymentBase":5553,"personalRatio":12,"companyRatio":12,"personalPay":"666.36","companyPay":"666.36"}
            // }
            personalEndowmentInsurance: insuranceConfig.endowmentInsurance.personalPay, // 养老保险
            personalMedicalInsurance: insuranceConfig.medicalInsurance.personalPay, // 医疗保险
            personalUnemploymentInsurance: insuranceConfig.unemploymentInsurance.personalPay, // 失业保险
            personalInjuryInsurance: insuranceConfig.injuryInsurance.personalPay, // 工伤保险
            personalMaternityInsurance: insuranceConfig.maternityInsurance.personalPay, // 生育保险
            personalHousingFund: insuranceConfig.housingFund.personalPay, // 住房公积金

            companyEndowmentInsurance: insuranceConfig.endowmentInsurance.companyPay, // 养老保险
            companyMedicalInsurance: insuranceConfig.medicalInsurance.companyPay, // 医疗保险
            companyUnemploymentInsurance: insuranceConfig.unemploymentInsurance.companyPay, // 失业保险
            companyInjuryInsurance: insuranceConfig.injuryInsurance.companyPay, // 工伤保险
            companyMaternityInsurance: insuranceConfig.maternityInsurance.companyPay, // 生育保险
            companyHousingFund: insuranceConfig.housingFund.companyPay, // 住房公积金
          }

          salaryRecord.companyInsuranceAmount = parseFloat(salaryRecord.companyEndowmentInsurance) + parseFloat(salaryRecord.companyMedicalInsurance) + parseFloat(salaryRecord.companyUnemploymentInsurance) + parseFloat(salaryRecord.companyInjuryInsurance) + parseFloat(salaryRecord.companyMaternityInsurance) + parseFloat(salaryRecord.companyHousingFund);
          salaryRecord.companyInsuranceAmountTotal = salaryRecord.companyInsuranceAmount;

          salaryRecord.personalInsuranceAmount = parseFloat(salaryRecord.personalEndowmentInsurance) + parseFloat(salaryRecord.personalMedicalInsurance) + parseFloat(salaryRecord.personalUnemploymentInsurance) + parseFloat(salaryRecord.personalInjuryInsurance) + parseFloat(salaryRecord.personalMaternityInsurance) + parseFloat(salaryRecord.personalHousingFund);
          salaryRecord.employeeCostTotal = salaryRecord.personalInsuranceAmount + salaryRecord.companyInsuranceAmount;
          await trx(tableEnum.salary_record, this.ctx).insert(salaryRecord);
        }
      })
      return {rows: employeeList}
    }
    return {};
  }

  async saveCustomSalaryProject() {
    const { jianghuKnex } = this.app;
    const {actionData} = this.ctx.request.body.appData;
    const result = await jianghuKnex(tableEnum._constant, this.ctx).where({constantKey: 'customSalarySubject'}).select();
    if (result) {
      await jianghuKnex(tableEnum._constant, this.ctx).where({constantKey: 'customSalarySubject'}).update({constantValue: JSON.stringify(actionData)});
    } else {
      await jianghuKnex(tableEnum._constant, this.ctx).insert({constantKey: 'customSalarySubject', constantValue: JSON.stringify(actionData)});
    }
    return {
      success: true
    };
  }

  async saveChanged() {
    const { jianghuKnex } = this.app;
    const {actionData, where} = this.ctx.request.body.appData;
    const {dataList} = actionData;

    const employeeColumnInfo = await jianghuKnex(tableEnum.employee, this.ctx).columnInfo();
    const employeeField = Object.keys(employeeColumnInfo).filter(item => !['id', 'operationAt', 'operationByUser', 'operationByUserId'].includes(item));
    await jianghuKnex.transaction(async trx => {
      for (const salaryRecordListElement of dataList) {
        const omitData = _.omit(salaryRecordListElement, employeeField);
        const {id,...data} = omitData;
        await trx(tableEnum.salary_record, this.ctx).update(data).where({id});
      }
      // 重新计算表数据 salary_month_record 并更新
      const salaryMonthRecordId = `${where.year}-${where.month}`;
      const salaryRecordList = await trx(tableEnum.salary_record, this.ctx).where({salaryMonthRecordId}).select();
      const salaryMonthRecord = {
        salaryMonthRecordId,
        expectedPaySalaryTotal: _.sumBy(salaryRecordList, 'expectedPaySalary'),
        totalDeductSalaryTotal: _.sumBy(salaryRecordList, 'totalDeductSalary'),
        realPaySalaryTotal: _.sumBy(salaryRecordList, 'realPaySalary'),
        employeeCostTotal: _.sumBy(salaryRecordList, 'employeeCostTotal'),
      }
      await trx(tableEnum.salary_month_record, this.ctx).update(salaryMonthRecord).where({salaryMonthRecordId});
    })
    return {
      success: true
    };
  }

  async syncVoucherIdToInvoice() {
    const { jianghuKnex } = this.app;
    const {actionData, where} = this.ctx.request.body.appData;
    const {voucherNewId: voucherId, id} = actionData;
    // 同步该 voucherId 到 tableEnum.invoice 的 voucherId
    await jianghuKnex.transaction(async trx => {
      await trx(tableEnum.salary_month_record, this.ctx).update({voucherId}).where({id});
    });
  }

  async deleteSelected() {
    const { jianghuKnex } = this.app;
    const {actionData, where} = this.ctx.request.body.appData;
    const {idList} = where;
    if (!idList || !idList.length) {
      throw new BizError(errorInfoEnum.salary_entry_id_not_exist);
    }
    const entryItemList = await jianghuKnex(tableEnum.salary_record, this.ctx).whereIn('id', idList).select();
    if (!entryItemList.length) {
      throw new BizError(errorInfoEnum.salary_entry_not_exist);
    }
    await jianghuKnex(tableEnum.salary_record, this.ctx).whereIn('id', idList).delete();

    await jianghuKnex.transaction(async trx => {
      // 重新计算月工资表
      const salaryMonthRecordId = `${entryItemList[0].year}-${entryItemList[0].month}`;
      const salaryRecordList = await trx(tableEnum.salary_record, this.ctx).where({salaryMonthRecordId}).select();
      const salaryMonthRecord = {
        salaryMonthRecordId,
        expectedPaySalaryTotal: _.sumBy(salaryRecordList, 'expectedPaySalary'),
        totalDeductSalaryTotal: _.sumBy(salaryRecordList, 'totalDeductSalary'),
        realPaySalaryTotal: _.sumBy(salaryRecordList, 'realPaySalary'),
        employeeCostTotal: _.sumBy(salaryRecordList, 'employeeCostTotal'),
      }
      await trx(tableEnum.salary_month_record, this.ctx).update(salaryMonthRecord).where({salaryMonthRecordId});
    })
  }

  async importExcel() {
    const { jianghuKnex } = this.app;
    const {actionData, where} = this.ctx.request.body.appData;
    const {willImportJson} = actionData;
    if (!willImportJson.length) {
      throw new BizError(errorInfoEnum.salary_entry_import_data_is_empty);
    }
    const employeeColumnInfo = await jianghuKnex(tableEnum.employee, this.ctx).columnInfo();
    const employeeField = Object.keys(employeeColumnInfo).filter(item => !['id', 'operationAt', 'operationByUser', 'operationByUserId', 'employeeId'].includes(item));
    await jianghuKnex.transaction(async trx => {
      // 重新计算月工资表
      const salaryMonthRecordId = `${where.year}-${where.month}`;
      for (const actionDataItem of willImportJson) {
        actionDataItem.salaryRecordId = `${actionDataItem.employeeId}-${dayjs().format('YYYY-MM')}`;
        actionDataItem.salaryMonthRecordId = salaryMonthRecordId;
        actionDataItem.year = where.year;
        actionDataItem.month = where.month;
        const omitData = _.omit(actionDataItem, employeeField);
        const {id,...data} = omitData;
        await trx(tableEnum.salary_record, this.ctx).insert(omitData);
      }
      const salaryMonthRecord = {
        salaryMonthRecordId,
        expectedPaySalaryTotal: _.sumBy(willImportJson, 'expectedPaySalary'),
        totalDeductSalaryTotal: _.sumBy(willImportJson, 'totalDeductSalary'),
        realPaySalaryTotal: _.sumBy(willImportJson, 'realPaySalary'),
        employeeCostTotal: _.sumBy(willImportJson, 'employeeCostTotal'),
      }
      await trx(tableEnum.salary_month_record, this.ctx).update(salaryMonthRecord).where({salaryMonthRecordId});
    })
  }

}

module.exports = SalaryService;
