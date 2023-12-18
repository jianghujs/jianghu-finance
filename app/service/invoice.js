const Service = require('egg').Service;
const validateUtil = require('@jianghujs/jianghu/app/common/validateUtil');
const {tableEnum} = require('../constant/constant');
const _ = require('lodash');
const dayjs = require('dayjs');
const {errorInfoEnum, BizError} = require('../constant/error');

const actionDataScheme = Object.freeze({});

class InvoiceService extends Service {
  async selectInvoice() {
    const {jianghuKnex} = this.app;
    const appData = this.ctx.request.body.appData;
    const {whereNull, whereNotNull, where, orderBy, actionData} = appData;
    let rows = [];
    if (whereNull) {
      rows = await jianghuKnex(tableEnum.view01_invoice, this.ctx).where(where).whereNull(whereNull).orderBy(orderBy).select();
    }
    if (whereNotNull) {
      rows = await jianghuKnex(tableEnum.view01_invoice, this.ctx).where(where).whereNotNull(whereNotNull).orderBy(orderBy).select();
    }
    rows = await jianghuKnex(tableEnum.view01_invoice, this.ctx).where(where).orderBy(orderBy).select();
  
    return {rows}
  }

  async createItem() {
    const {jianghuKnex} = this.app;
    const actionData = this.ctx.request.body.appData.actionData;
    const {invoiceEntryList, ...data} = actionData;

    await jianghuKnex.transaction(async trx => {
      if (!invoiceEntryList) {
        throw new BizError(errorInfoEnum.invoice_entry_list_must_has_data);
      }
      data.periodId = dayjs().format('YYYY-MM');
      let lastInvoiceId = await trx(tableEnum.invoice, this.ctx).where({periodId: data.periodId}).max('invoiceId').first();
      lastInvoiceId = Object.values(lastInvoiceId);
      let invoiceId = 0;
      if(lastInvoiceId.length && lastInvoiceId[0]) {
        invoiceId = parseInt(lastInvoiceId[0].substring(8));
      }
      console.log(invoiceId)
      const invoiceEntryId = 0;
      data.invoiceId = `${data.periodId}-${_.padStart(`${invoiceId + 1}`, 6, '0')}`;
      await trx(tableEnum.invoice, this.ctx).insert(data);
      for (const entryItem of invoiceEntryList) {
        entryItem.invoiceId = data.invoiceId;
        entryItem.invoiceEntryId = `${data.invoiceId}_${_.padStart(`${invoiceEntryId + 1}`, 6, '0')}`;
        await trx(tableEnum.invoice_entry, this.ctx).insert(entryItem);
      }
    })
  }
  async updateItem() {
    const {jianghuKnex} = this.app;
    const {actionData} = this.ctx.request.body.appData;
    const {invoiceEntryList, ...data} = actionData;

    await jianghuKnex.transaction(async trx => {
      if (!invoiceEntryList) {
        throw new BizError(errorInfoEnum.invoice_entry_list_must_has_data);
      }
      await trx(tableEnum.invoice, this.ctx).update(data).where({id: actionData.id});
      // 删除多余的
      const existItemList = await trx(tableEnum.invoice_entry, this.ctx).where({invoiceId: data.invoiceId}).select();
      const existItemIds = existItemList.map(item => item.invoiceEntryId);
      const deleteItemIds = existItemIds.filter(item => !invoiceEntryList.map(item => item.invoiceEntryId).includes(item));
      await trx(tableEnum.invoice_entry, this.ctx).delete().whereIn('invoiceEntryId', deleteItemIds);

      for (const entryItem of invoiceEntryList) {
        if(entryItem.invoiceEntryId) {
          delete entryItem.id;
          await trx(tableEnum.invoice_entry, this.ctx).update(entryItem).where({invoiceEntryId: entryItem.invoiceEntryId});
        } else {
          let lastInvoiceEntryId = await trx(tableEnum.invoice_entry, this.ctx).where({invoiceId: data.invoiceId}).max('invoiceEntryId').first();
          lastInvoiceEntryId = Object.values(lastInvoiceEntryId);
          let invoiceEntryId = 0;
          if(lastInvoiceEntryId.length) {
            invoiceEntryId = parseInt(lastInvoiceEntryId[0].substring(lastInvoiceEntryId[0].length - 6));
          }
          entryItem.invoiceId = data.invoiceId;
          entryItem.invoiceEntryId = `${data.invoiceId}_${_.padStart(`${invoiceEntryId + 1}`, 6, '0')}`;
          await trx(tableEnum.invoice_entry, this.ctx).insert(entryItem);
        }
      }
    })
  }
  async deleteItem() {
    const {jianghuKnex} = this.app;
    const {actionData, where} = this.ctx.request.body.appData;

    await jianghuKnex.transaction(async trx => {
      if (!where.id) {
        throw new BizError(errorInfoEnum.invoice_entry_id_not_exist);
      }
      const entryItem = await trx(tableEnum.invoice, this.ctx).where(where).first();
      if(!entryItem) {
        throw new BizError(errorInfoEnum.invoice_entry_not_exist);
      }
      await trx(tableEnum.invoice, this.ctx).delete().where(where);
      await trx(tableEnum.invoice_entry, this.ctx).delete().where({invoiceId: entryItem.invoiceId});
    })
  }

  async deleteSelected() {
    const {jianghuKnex} = this.app;
    const {actionData, where} = this.ctx.request.body.appData;
    const {idList} = where;
    await jianghuKnex.transaction(async trx => {
      if (!idList || !idList.length) {
        throw new BizError(errorInfoEnum.invoice_entry_id_not_exist);
      }
      const entryItemList = await trx(tableEnum.invoice, this.ctx).whereIn('id', idList).select();
      if(!entryItemList.length) {
        throw new BizError(errorInfoEnum.invoice_entry_not_exist);
      }
      await trx(tableEnum.invoice, this.ctx).delete().whereIn('id', idList);
      await trx(tableEnum.invoice_entry, this.ctx).delete().whereIn('invoiceId', entryItemList.map(item => item.invoiceId));
    })
  }

  async syncVoucherIdToInvoice () {
    const {jianghuKnex} = this.app;
    const {actionData, where} = this.ctx.request.body.appData;
    const {voucherNewId: voucherId, id} = actionData;
    // 同步该 voucherId 到 tableEnum.invoice 的 voucherId
    await jianghuKnex(tableEnum.invoice, this.ctx).update({voucherId}).where({id});

  }
}

module.exports = InvoiceService;
