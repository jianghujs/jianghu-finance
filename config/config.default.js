'use strict';

const path = require('path');
const assert = require('assert');

const { middleware, middlewareMatch } = require('@jianghujs/jianghu/config/middlewareConfig');

const eggJianghuPathTemp = require.resolve('@jianghujs/jianghu');
const eggJianghuPath = path.join(eggJianghuPathTemp, '../');

module.exports = appInfo => {
  assert(appInfo);

  const appId = 'jh-finance';
  const uploadDir = path.join(appInfo.baseDir, 'upload');
  const downloadBasePath = `/${appId}/upload`;

  return {
    jianghuConfig: {
      ignoreTableListOfAppaId: [ '_cache','_constant','_group','_page','_record_history',
        '_resource','_role','_test_case','_ui','_user','_user_group_role','_user_group_role_page',
        '_user_group_role_resource','_user_session','_view01_user', '_view02_user_app', '_app_account', '_directory_user_session'
      ],
    },
    // 禁用编辑的帐套; 避免数据被删除
    appaIdDisableEditList: ['GS03'],
    // 是否开启select-period组件的全选功能
    selectPeriodAllSwitch: false,
    isAudit: true,
    appId,
    appTitle: '财务管理',
    appLogo: `${appId}/public/img/logo.png`,
    appType: 'single',
    appDirectoryLink: '/',
    indexPage: `/${appId}/page/checkout-periodCheckout`,
    loginPage: `/${appId}/page/login`,
    helpPage: `/${appId}/page/help`,
    uploadDir,
    downloadBasePath,
    primaryColor: "#4caf50",
    primaryColorA80: "#EEF7EE",
    static: {
      maxAge: 0,
      buffer: false,
      preload: false,
      maxFiles: 0,
      dir: [
        { prefix: `/${appId}/public/`, dir: path.join(appInfo.baseDir, 'app/public') },
        { prefix: `/${appId}/public/`, dir: path.join(eggJianghuPath, 'app/public') },
        { prefix: `/${appId}/upload/`, dir: uploadDir },
      ],
    },
    view: {
      defaultViewEngine: 'nunjucks',
      mapping: { '.html': 'nunjucks' },
      root: [
        path.join(appInfo.baseDir, 'app/view'),
        path.join(eggJianghuPath, 'app/view'),
      ].join(','),
    },
    middleware,
    ...middlewareMatch,
  };

};
