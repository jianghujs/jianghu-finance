const Service = require('egg').Service;
const _ = require('lodash');
const { tableEnum } = require('../constant/constant');
const { BizError, errorInfoEnum } = require('../constant/error');
const idGenerateUtil = require("@jianghujs/jianghu/app/common/idGenerateUtil");


class FundAccountEntryService extends Service {

  async removeVoucher() {
    const { jianghuKnex } = this.app
    const { actionData } = this.ctx.request.body.appData
    const { voucherId } = actionData;
    if (voucherId) {
      const voucher = await jianghuKnex(tableEnum.voucher, this.ctx).where({ voucherId }).select().first();
      const { periodId } = voucher;
      if (!voucher) {
        throw new BizError(errorInfoEnum.voucher_not_exist)
      }
      const period = await jianghuKnex(tableEnum.period, this.ctx).where({ periodId }).select().first();
      if (!period || period.isCheckout !== '待结账') {
        throw new BizError(errorInfoEnum.period_has_checkout)
      }
  
      await jianghuKnex.transaction(async trx => {
        await trx(tableEnum.voucher, this.ctx).where({ voucherId }).delete();
        await trx(tableEnum.voucher_entry, this.ctx).where({ voucherId }).delete();
      });
  
      this.ctx.service.period.computeSubjectBalancePeriod({ periodId });
    }
  }

  async getStatementGroup() {
    const { jianghuKnex } = this.app
    
    const distinctAccountId = await jianghuKnex(tableEnum.fund_account_entry, this.ctx).distinct('accountId').select();
    const distinctTemplate = await jianghuKnex(tableEnum.fund_account_entry, this.ctx).distinct('templateName').select();
    
    return { 
      distinctAccountIds: distinctAccountId.map(x => x.accountId), 
      distinctTemplateNames: distinctTemplate.map(x => x.templateName)
    };
  }

  async batchInsertFundAccountEntryData(fundAccountEntryList){
    const { jianghuKnex } = this.app
    if (_.isEmpty(fundAccountEntryList)) {
      throw new BizError(errorInfoEnum.data_exception);
    };
    const idSequence = await jianghuKnex(tableEnum.fund_account_entry, this.ctx).max('idSequence', { as: "idSequence" }).first();
    for (const fundAccountEntry of fundAccountEntryList) {
      fundAccountEntry.idSequence = idSequence++;
      fundAccountEntry.accountEntryId = `JZ${fundAccountEntry.idSequence}`;
    }
    await jianghuKnex(tableEnum.fund_account_entry, this.ctx).insert(fundAccountEntryList);
  }

  async importFundAccountEntryData(){
    const { jianghuKnex } = this.app
    const { importData } = this.ctx.request.body.appData.actionData

    if (_.isEmpty(importData)) {
      throw new BizError(errorInfoEnum.data_exception);
    };


    let idSequence = await idGenerateUtil.idPlus({
      knex: jianghuKnex,
      tableName: tableEnum.fund_account_entry,
      columnName: 'idSequence',
    })

    await jianghuKnex.transaction(async trx => {
      for (const importItem of importData) {
        importItem.idSequence = idSequence++;
        importItem.accountEntryId = `JZ${importItem.idSequence}`;

        await trx(tableEnum.fund_account_entry, this.ctx).insert(importItem);
      }
    });
  }
}

module.exports = FundAccountEntryService;