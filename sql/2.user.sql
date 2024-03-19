
-- ----------------------------
-- Table structure for _user
-- ----------------------------
DROP TABLE IF EXISTS `_user`;
CREATE TABLE `_user`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `idSequence` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '自增id; 用于生成userId',
  `userId` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '主键id',
  `username` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '用户名(登陆)',
  `phoneNumber` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '电话',
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '邮箱',
  `userStatus` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT 'active' COMMENT '用户账号状态：活跃或关闭',
  `hrOrgRoleList` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '职位',
  `qiweiId` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '企微ID_mega\r\n',
  `wechatId` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '微信ID',
  `userConfig` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL COMMENT '配置信息',
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '密码',
  `md5Salt` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT 'md5Salt',
  `clearTextPassword` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '明文密码',
  `operation` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT 'insert' COMMENT '操作; insert, update, jhInsert, jhUpdate, jhDelete jhRestore',
  `operationByUserId` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '操作者userId',
  `operationByUser` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '操作者用户名',
  `operationAt` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '操作时间; E.g: 2021-05-28T10:24:54+08:00 ',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `userId_index`(`userId`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 266 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '用户表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of _user
-- ----------------------------
INSERT INTO `_user` VALUES (21, '', 'admin', '超级管理员', NULL, NULL, 'active', NULL, NULL, NULL, NULL, '38d61d315e62546fe7f1013e31d42f57', 'Xs4JSZnhiwsR', '123456', 'update', 'admin', '超级管理员', '2023-12-22T21:15:59+08:00');
INSERT INTO `_user` VALUES (22, '', 'admin01', '超级管理员01', NULL, NULL, 'active', NULL, NULL, NULL, NULL, '38d61d315e62546fe7f1013e31d42f57', 'Xs4JSZnhiwsR', '123456', 'update', NULL, NULL, '2022-02-19T15:02:24+08:00');
INSERT INTO `_user` VALUES (23, '', 'admin02', '超级管理员02', NULL, NULL, 'active', NULL, NULL, NULL, NULL, '38d61d315e62546fe7f1013e31d42f57', 'Xs4JSZnhiwsR', '123456', 'update', NULL, NULL, '2022-02-19T15:02:24+08:00');
INSERT INTO `_user` VALUES (24, '', 'admin03', '超级管理员03', NULL, NULL, 'active', NULL, NULL, NULL, NULL, '38d61d315e62546fe7f1013e31d42f57', 'Xs4JSZnhiwsR', '123456', 'update', NULL, NULL, '2022-02-19T15:02:24+08:00');
INSERT INTO `_user` VALUES (231, NULL, 'E41000X', '成功', '13576609533', NULL, 'active', NULL, NULL, NULL, NULL, 'b567ec69ff554f1509cc7dda831034c5', 'JSFwK8JjrMGE', 'ZA6nSj', 'jhInsert', 'admin', '超级管理员', '2024-03-18T20:41:02+08:00');
INSERT INTO `_user` VALUES (232, NULL, 'E41001Q', '冯正', '18616333333', NULL, 'active', NULL, NULL, NULL, NULL, 'bb959a2814e1db3cbbb7b2f483fcdfe9', 'm4BpcbbD7hTA', 'wd5zPf', 'jhInsert', 'admin', '超级管理员', '2024-03-18T20:41:02+08:00');
INSERT INTO `_user` VALUES (233, NULL, 'E41002S', '龙志平', '13879661218', NULL, 'active', NULL, NULL, NULL, NULL, '37888afc7ad974cff254c283be29d04f', '12iD8CJ95eKb', 'ED2Dca', 'jhInsert', 'admin', '超级管理员', '2024-03-18T20:41:02+08:00');
INSERT INTO `_user` VALUES (234, NULL, 'H00002', '张娜', '13634567890', NULL, 'active', NULL, NULL, NULL, NULL, 'dfea3802722b8932663cd6668643cc76', 'XPfApSP7T1i4', 'kSNydB', 'jhInsert', 'admin', '超级管理员', '2024-03-18T20:41:02+08:00');
INSERT INTO `_user` VALUES (235, NULL, 'G00002', '王五', NULL, NULL, 'active', NULL, NULL, NULL, NULL, '72ffa774b4a19f7fa44f68a48fcdbac7', '1GrC65MGee3D', 'xXCF1R', 'jhInsert', 'admin', '超级管理员', '2024-03-18T20:41:02+08:00');
INSERT INTO `_user` VALUES (236, NULL, 'W00001', '刘磊', '13745678901', NULL, 'active', NULL, NULL, NULL, NULL, '5de7e182c4e5d407af886d260b92d1a5', 'kFdpDDX1SHNZ', 'zysM5b', 'jhInsert', 'admin', '超级管理员', '2024-03-18T20:41:02+08:00');
INSERT INTO `_user` VALUES (237, NULL, 'G00003', '王雷', '13923456789', NULL, 'active', NULL, NULL, NULL, NULL, '7e19a4e5037ec69ae60b68ebb9176e6e', 'MxxtmYyMXcGm', 'MEMFHn', 'jhInsert', 'admin', '超级管理员', '2024-03-18T20:41:02+08:00');
INSERT INTO `_user` VALUES (238, NULL, 'L00001', '熊大', '13399998888', NULL, 'active', NULL, NULL, NULL, NULL, 'ed7a63e1ed232ca7ccd70f19c7e413e1', 'tb5Jk8dZyDaC', 'Cy9QYN', 'jhInsert', 'admin', '超级管理员', '2024-03-18T20:41:02+08:00');
INSERT INTO `_user` VALUES (239, NULL, 'E41004V', '李华', '13812345678', NULL, 'active', NULL, NULL, NULL, NULL, 'f67987264dc1cb9f73ae9c2a555c6ff6', 'D8m18ACmY181', 'RdwC84', 'jhInsert', 'admin', '超级管理员', '2024-03-18T20:41:02+08:00');
INSERT INTO `_user` VALUES (240, NULL, 'E41008B', '陈梅', '13556789012', NULL, 'active', NULL, NULL, NULL, NULL, '378e04b4ff26168ff537061418aefcb6', 'nZYWtRYtn2yJ', 'P8a8b8', 'jhInsert', 'admin', '超级管理员', '2024-03-18T20:41:02+08:00');
INSERT INTO `_user` VALUES (241, NULL, 'E41009W', '赵阳', '13467890123', NULL, 'active', NULL, NULL, NULL, NULL, '02a904a04eab0a358806d927da7af7cb', '6SXNwfHJiSpY', 'PTjANi', 'jhInsert', 'admin', '超级管理员', '2024-03-18T20:41:02+08:00');
INSERT INTO `_user` VALUES (242, NULL, 'E41010R', '黄莉', '13378901234', NULL, 'active', NULL, NULL, NULL, NULL, 'd8fb523017d6437c756956243ea0f0ff', 'XZ4NaEKWtN3W', 'Cz6yFX', 'jhInsert', 'admin', '超级管理员', '2024-03-18T20:41:02+08:00');
INSERT INTO `_user` VALUES (243, NULL, 'E41011L', '刘洋', '13289012345', NULL, 'active', NULL, NULL, NULL, NULL, '0d3780d6be914131841421ba3e95dfee', 'P3TJRkF7JY5K', 'NGcC5Z', 'jhInsert', 'admin', '超级管理员', '2024-03-18T20:41:02+08:00');
INSERT INTO `_user` VALUES (244, NULL, 'E41012G', '李峰', '13190123456', NULL, 'active', NULL, NULL, NULL, NULL, '1efe860a7ec3ef21cef98b5c9623c6a5', 'B7YhMEsM6b9C', 'H8a1pN', 'jhInsert', 'admin', '超级管理员', '2024-03-18T20:41:02+08:00');
INSERT INTO `_user` VALUES (245, NULL, 'E41013C', '周琳', '13001234567', NULL, 'active', NULL, NULL, NULL, NULL, 'b68d492317e8696d0dd023c049a167ca', 'DNk1dGstfw7h', 'Ac99xK', 'jhInsert', 'admin', '超级管理员', '2024-03-18T20:41:02+08:00');
INSERT INTO `_user` VALUES (246, NULL, 'E41014X', '吴晓', '13911223344', NULL, 'active', NULL, NULL, NULL, NULL, 'f22eea7241f480638964c6b18097eda5', '6ib9Y7PYbJ2H', 'jnBnCh', 'jhInsert', 'admin', '超级管理员', '2024-03-18T20:41:02+08:00');
INSERT INTO `_user` VALUES (247, NULL, 'E41015T', '王凯', '13822113344', NULL, 'active', NULL, NULL, NULL, NULL, 'ba0a871fc270cb9f2f0ccf225b87a50a', 'waEHmA1bAbS2', '51w1fk', 'jhInsert', 'admin', '超级管理员', '2024-03-18T20:41:02+08:00');
INSERT INTO `_user` VALUES (248, NULL, 'E41016M', '杨宁', '13733112233', NULL, 'active', NULL, NULL, NULL, NULL, '647e46f44887b2860735bae8e0c452c2', 'W2peyz9FrHy9', '7BWNM7', 'jhInsert', 'admin', '超级管理员', '2024-03-18T20:41:02+08:00');
INSERT INTO `_user` VALUES (249, NULL, 'E41017H', '赵敏', '13644112233', NULL, 'active', NULL, NULL, NULL, NULL, '35e2300b9ff0949a0a1bd09bc77e103c', 'cXMckDhx3p35', '8RKedp', 'jhInsert', 'admin', '超级管理员', '2024-03-18T20:41:02+08:00');
INSERT INTO `_user` VALUES (250, NULL, 'E41018D', '朱丽', '13555112233', NULL, 'active', NULL, NULL, NULL, NULL, '81044dfa78365ba33b062e5477fdce24', 'kDQfNnPJZPPH', '8zHs98', 'jhInsert', 'admin', '超级管理员', '2024-03-18T20:41:02+08:00');
INSERT INTO `_user` VALUES (251, NULL, 'E41019Y', '郭强', '13466112233', NULL, 'active', NULL, NULL, NULL, NULL, '123093f6641507123888787ac9a7b2bb', 'NF7zx4idpnzM', 'mzAcxd', 'jhInsert', 'admin', '超级管理员', '2024-03-18T20:41:02+08:00');
INSERT INTO `_user` VALUES (252, NULL, 'E41020U', '何磊', '13377112233', NULL, 'active', NULL, NULL, NULL, NULL, 'dbb851f2cdb895d23a7d196517bbf4f1', 'S4ADFJSsdNCp', 'hXG9iW', 'jhInsert', 'admin', '超级管理员', '2024-03-18T20:41:02+08:00');
INSERT INTO `_user` VALUES (253, NULL, 'E41021N', '秦芳', '13288112233', NULL, 'active', NULL, NULL, NULL, NULL, '82ae10e4f0851a56ca4b80b0e08712d0', 'AyjEaPW7XJnF', 'wj6CnR', 'jhInsert', 'admin', '超级管理员', '2024-03-18T20:41:02+08:00');
INSERT INTO `_user` VALUES (254, NULL, 'E41022J', '罗刚', '13199112233', NULL, 'active', NULL, NULL, NULL, NULL, 'fa074e37252134593633f834d5633fd3', '36GXifbHERyr', 'SpwTYn', 'jhInsert', 'admin', '超级管理员', '2024-03-18T20:41:02+08:00');
INSERT INTO `_user` VALUES (255, NULL, 'E41023E', '杨洋', '13000112233', NULL, 'active', NULL, NULL, NULL, NULL, '152d9310f8d4dacb24a903e850d9408f', 'whGxHFYYBX2y', 'SKzawG', 'jhInsert', 'admin', '超级管理员', '2024-03-18T20:41:02+08:00');
INSERT INTO `_user` VALUES (256, NULL, 'E41024A', '韩梅', '13911223355', NULL, 'active', NULL, NULL, NULL, NULL, '44dac9c2d18c0dc3cdd4ec5ce9db834e', '7Qt4We1BhmeH', 'rXjwQZ', 'jhInsert', 'admin', '超级管理员', '2024-03-18T20:41:02+08:00');
INSERT INTO `_user` VALUES (257, NULL, 'E41025V', '张鹏', '13911223366', NULL, 'active', NULL, NULL, NULL, NULL, 'b8c749ff53acf0f65b56ba545f9e4742', 'P1dt6pmKw4Cb', 'Kkj26B', 'jhInsert', 'admin', '超级管理员', '2024-03-18T20:41:02+08:00');
INSERT INTO `_user` VALUES (258, NULL, 'E41026P', '黄勇', '13911223377', NULL, 'active', NULL, NULL, NULL, NULL, 'a7867ef12a5a971557b4e04180384fe1', 'MCjW3GiKCGdj', '54jmEP', 'jhInsert', 'admin', '超级管理员', '2024-03-18T20:41:02+08:00');
INSERT INTO `_user` VALUES (259, NULL, 'E41027K', '刘莉', '13911223388', NULL, 'active', NULL, NULL, NULL, NULL, 'bceeb406fa32a50d945d688581d2ae64', 'PeQ2bNdbwQcf', 'RPe92N', 'jhInsert', 'admin', '超级管理员', '2024-03-18T20:41:02+08:00');
INSERT INTO `_user` VALUES (260, NULL, 'E41028F', '赵婷', '13911223399', NULL, 'active', NULL, NULL, NULL, NULL, 'f249cc37f2a43c9ad9198d1987b342f4', 'p79sGMkn8hTi', 'GFZZK5', 'jhInsert', 'admin', '超级管理员', '2024-03-18T20:41:02+08:00');
INSERT INTO `_user` VALUES (261, NULL, 'E41029B', '李涛', '13911223300', NULL, 'active', NULL, NULL, NULL, NULL, '95a6c604e1c19f702a5d164b6f85c85b', 'hJSNMp8eEKW9', '2WSibh', 'jhInsert', 'admin', '超级管理员', '2024-03-18T20:41:02+08:00');
INSERT INTO `_user` VALUES (262, NULL, 'E41030W', '王雪', '13911223311', NULL, 'active', NULL, NULL, NULL, NULL, 'aa79be4f045cc768f0a5bdb0df1a4dcd', 'jn1YZdmXYYEQ', 'fhA8eN', 'jhInsert', 'admin', '超级管理员', '2024-03-18T20:41:02+08:00');
INSERT INTO `_user` VALUES (263, NULL, 'E41031R', '周杰', '13911223322', NULL, 'active', NULL, NULL, NULL, NULL, '91d80bd52148f5bace64e4fc2baf222a', 'HEmBS1XQdp5G', 'RD4JZR', 'jhInsert', 'admin', '超级管理员', '2024-03-18T20:41:02+08:00');
INSERT INTO `_user` VALUES (264, NULL, 'E41032L', '陈雨', '13911223333', NULL, 'active', NULL, NULL, NULL, NULL, '8be8bb6ca1cd8770ac0300467f7d4dfd', 'jdsxjBZGczND', 'aNzFbG', 'jhInsert', 'admin', '超级管理员', '2024-03-18T20:41:02+08:00');
INSERT INTO `_user` VALUES (265, NULL, 'E41033G', '李明', '13911223344', NULL, 'active', NULL, NULL, NULL, NULL, 'b586cfcc90d1e20dd75d569bcee15486', 'aZ1GenjiGPs7', 'zMfWnc', 'jhInsert', 'admin', '超级管理员', '2024-03-18T20:41:02+08:00');


-- ----------------------------
-- Table structure for _user_group_role
-- ----------------------------
DROP TABLE IF EXISTS `_user_group_role`;
CREATE TABLE `_user_group_role` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` varchar(255) NOT NULL COMMENT '用户id',
  `groupId` varchar(255) NOT NULL COMMENT '群组Id',
  `roleId` varchar(255) DEFAULT NULL COMMENT '角色Id',
  `roleDeadline` varchar(255) DEFAULT NULL COMMENT '权限期限日期',
  `operation` varchar(255) DEFAULT 'insert' COMMENT '操作; insert, update, jhInsert, jhUpdate, jhDelete jhRestore',
  `operationByUserId` varchar(255) DEFAULT NULL COMMENT '操作者userId',
  `operationByUser` varchar(255) DEFAULT NULL COMMENT '操作者用户名',
  `operationAt` varchar(255) DEFAULT NULL COMMENT '操作时间; E.g: 2021-05-28T10:24:54+08:00 ',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `groupId_index` (`groupId`) USING BTREE,
  KEY `userId_index` (`userId`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=691 DEFAULT CHARSET=utf8mb4 COMMENT='用户群组角色关联表; 软删除未启用;';
INSERT INTO `_user_group_role` (`id`, `userId`, `groupId`, `roleId`, `roleDeadline`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (654, 'admin03', '超级管理员', NULL, '-1', 'insert', 'admin', '超级管理员', '2024-03-15T11:40:05+08:00');
INSERT INTO `_user_group_role` (`id`, `userId`, `groupId`, `roleId`, `roleDeadline`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (656, 'admin', '超级管理员', NULL, '-1', 'insert', 'admin', '超级管理员', '2024-03-15T11:40:14+08:00');
INSERT INTO `_user_group_role` (`id`, `userId`, `groupId`, `roleId`, `roleDeadline`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (658, 'admin01', '超级管理员', NULL, '-1', 'insert', 'admin', '超级管理员', '2024-03-15T11:40:22+08:00');
INSERT INTO `_user_group_role` (`id`, `userId`, `groupId`, `roleId`, `roleDeadline`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (660, 'admin02', '超级管理员', NULL, '-1', 'insert', 'admin', '超级管理员', '2024-03-15T11:40:53+08:00');
INSERT INTO `_user_group_role` (`id`, `userId`, `groupId`, `roleId`, `roleDeadline`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (682, 'E41008B', '总公司-ZB-FD', '总公司-ZB-FD|财务管理员', '-1', 'insert', 'admin', '超级管理员', '2024-03-18T20:51:22+08:00');
INSERT INTO `_user_group_role` (`id`, `userId`, `groupId`, `roleId`, `roleDeadline`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (683, 'E41009W', '总公司-ZB-FD', '总公司-ZB-FD|会计角色', '-1', 'insert', 'admin', '超级管理员', '2024-03-18T20:51:34+08:00');
INSERT INTO `_user_group_role` (`id`, `userId`, `groupId`, `roleId`, `roleDeadline`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (684, 'E41010R', '总公司-ZB-FD', '总公司-ZB-FD|出纳角色', '-1', 'insert', 'admin', '超级管理员', '2024-03-18T20:51:46+08:00');
INSERT INTO `_user_group_role` (`id`, `userId`, `groupId`, `roleId`, `roleDeadline`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (685, 'E41010R', '总公司-ZB-FD', '总公司-ZB-FD|会计角色', '-1', 'insert', 'admin', '超级管理员', '2024-03-18T20:51:46+08:00');
INSERT INTO `_user_group_role` (`id`, `userId`, `groupId`, `roleId`, `roleDeadline`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (686, 'E41011L', '总公司-ZB-HR', '总公司-ZB-HR|HR管理员', '-1', 'insert', 'admin', '超级管理员', '2024-03-18T20:52:05+08:00');
INSERT INTO `_user_group_role` (`id`, `userId`, `groupId`, `roleId`, `roleDeadline`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (687, 'E41012G', '总公司-ZB-HR', '总公司-ZB-HR|招聘角色', '-1', 'insert', 'admin', '超级管理员', '2024-03-18T20:52:15+08:00');
INSERT INTO `_user_group_role` (`id`, `userId`, `groupId`, `roleId`, `roleDeadline`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (688, 'E41013C', '总公司-ZB-HR', '总公司-ZB-HR|资料员角色', '-1', 'insert', 'admin', '超级管理员', '2024-03-18T20:52:29+08:00');
INSERT INTO `_user_group_role` (`id`, `userId`, `groupId`, `roleId`, `roleDeadline`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (689, 'E41013C', '总公司-ZB-HR', '总公司-ZB-HR|资料员角色', '-1', 'insert', 'admin', '超级管理员', '2024-03-18T20:52:42+08:00');
INSERT INTO `_user_group_role` (`id`, `userId`, `groupId`, `roleId`, `roleDeadline`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (690, 'E41000X', '总公司-ZB-SYS', '总公司-ZB-SYS|信息管理员', '-1', 'insert', 'admin', '超级管理员', '2024-03-18T20:52:56+08:00');


-- ----------------------------
-- Table structure for _user_group_role_page
-- ----------------------------
DROP TABLE IF EXISTS `_user_group_role_page`;
CREATE TABLE `_user_group_role_page` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `appId` varchar(255) DEFAULT NULL,
  `user` text COMMENT 'userId 或者 通配符; 通配符: *',
  `group` varchar(255) DEFAULT NULL COMMENT 'groupId 或者 通配符; 通配符: *',
  `role` varchar(255) DEFAULT NULL COMMENT 'roleId 或者 通配符; 通配符: *',
  `page` longtext COMMENT 'pageId id',
  `allowOrDeny` varchar(255) DEFAULT NULL COMMENT '用户群组角色 匹配后 执行动作; allow、deny',
  `desc` varchar(255) DEFAULT NULL COMMENT '映射描述',
  `source` varchar(255) DEFAULT NULL COMMENT '数据来源; 手动录入, 通用权限',
  `operation` varchar(255) DEFAULT 'insert' COMMENT '操作; insert, update, jhInsert, jhUpdate, jhDelete jhRestore',
  `operationByUserId` varchar(255) DEFAULT NULL COMMENT '操作者userId',
  `operationByUser` varchar(255) DEFAULT NULL COMMENT '操作者用户名',
  `operationAt` varchar(255) DEFAULT NULL COMMENT '操作时间; E.g: 2021-05-28T10:24:54+08:00 ',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=321 DEFAULT CHARSET=utf8mb4 COMMENT='用户群组角色 - 页面 映射表; 软删除未启用;';
INSERT INTO `_user_group_role_page` (`id`, `appId`, `user`, `group`, `role`, `page`, `allowOrDeny`, `desc`, `source`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (1, '*', '*', 'public', '*', 'login', 'allow', '登陆页面; 开放所有用户;', NULL, 'insert', NULL, NULL, NULL);
INSERT INTO `_user_group_role_page` (`id`, `appId`, `user`, `group`, `role`, `page`, `allowOrDeny`, `desc`, `source`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (2, '*', '*', 'login', '*', 'help,manual', 'allow', '工具页; 开放给登陆用户;', NULL, 'insert', NULL, NULL, NULL);
INSERT INTO `_user_group_role_page` (`id`, `appId`, `user`, `group`, `role`, `page`, `allowOrDeny`, `desc`, `source`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (64, '*', '*', '超级管理员', '*', '*', 'allow', NULL, NULL, 'jhInsert', NULL, NULL, '2023-12-17T14:42:44+08:00');



-- ----------------------------
-- Table structure for _user_group_role_resource
-- ----------------------------
DROP TABLE IF EXISTS `_user_group_role_resource`;
CREATE TABLE `_user_group_role_resource` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `appId` varchar(255) DEFAULT NULL,
  `user` text COMMENT 'userId 或者 通配符; 通配符: *',
  `group` varchar(255) DEFAULT NULL COMMENT 'groupId 或者 通配符; 通配符: *',
  `role` varchar(255) DEFAULT NULL COMMENT 'roleId 或者 通配符; 通配符: *',
  `resource` mediumtext COMMENT 'resourceId 或者 通配符; 通配符: *, !resourceId',
  `allowOrDeny` varchar(255) DEFAULT NULL COMMENT '用户群组角色 匹配后 执行动作; allow、deny',
  `desc` varchar(255) DEFAULT NULL COMMENT '映射描述',
  `source` varchar(255) DEFAULT NULL COMMENT '数据来源; 手动录入, 通用权限',
  `operation` varchar(255) DEFAULT 'insert' COMMENT '操作; insert, update, jhInsert, jhUpdate, jhDelete jhRestore',
  `operationByUserId` varchar(255) DEFAULT NULL COMMENT '操作者userId',
  `operationByUser` varchar(255) DEFAULT NULL COMMENT '操作者用户名',
  `operationAt` varchar(255) DEFAULT NULL COMMENT '操作时间; E.g: 2021-05-28T10:24:54+08:00 ',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=218 DEFAULT CHARSET=utf8mb4 COMMENT='用户群组角色 - 请求资源 映射表; 软删除未启用;';
INSERT INTO `_user_group_role_resource` (`id`, `appId`, `user`, `group`, `role`, `resource`, `allowOrDeny`, `desc`, `source`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (1, '*', '*', 'public', '*', 'login.passwordLogin', 'allow', '登陆resource, 开放给所有用户', NULL, 'insert', NULL, NULL, NULL);
INSERT INTO `_user_group_role_resource` (`id`, `appId`, `user`, `group`, `role`, `resource`, `allowOrDeny`, `desc`, `source`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (2, '*', '*', 'login', '*', 'allPage.*', 'allow', '工具类resource, 开放给所有登陆成功的用户', NULL, 'insert', NULL, NULL, NULL);
INSERT INTO `_user_group_role_resource` (`id`, `appId`, `user`, `group`, `role`, `resource`, `allowOrDeny`, `desc`, `source`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (64, '*', '*', '超级管理员', '*', '*', 'allow', NULL, NULL, 'jhInsert', NULL, NULL, '2023-12-17T14:42:44+08:00');

-- ----------------------------
-- Table structure for _group
-- ----------------------------
DROP TABLE IF EXISTS `_group`;
CREATE TABLE `_group` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `groupId` varchar(511) CHARACTER SET utf8mb4 DEFAULT NULL,
  `groupLastId` varchar(255) CHARACTER SET utf8mb4 DEFAULT NULL COMMENT 'groupId',
  `groupPath` varchar(255) CHARACTER SET utf8mb4 DEFAULT NULL,
  `groupName` varchar(255) CHARACTER SET utf8mb4 DEFAULT NULL COMMENT '群组简称',
  `groupDeptName` varchar(255) COLLATE utf8mb4_bin DEFAULT NULL COMMENT '群组全称',
  `groupAllName` varchar(255) CHARACTER SET utf8mb4 DEFAULT NULL COMMENT '路径全名',
  `principalId` varchar(255) COLLATE utf8mb4_bin DEFAULT NULL COMMENT '组织负责人',
  `headId` varchar(255) COLLATE utf8mb4_bin DEFAULT NULL COMMENT '部门主管',
  `leadId` varchar(255) COLLATE utf8mb4_bin DEFAULT NULL COMMENT '分管领导; 未启用',
  `groupDesc` varchar(255) CHARACTER SET utf8mb4 DEFAULT NULL COMMENT '群组描述',
  `operation` varchar(255) CHARACTER SET utf8mb4 DEFAULT 'insert' COMMENT '操作; insert, update, jhInsert, jhUpdate, jhDelete jhRestore',
  `operationByUserId` varchar(255) CHARACTER SET utf8mb4 DEFAULT NULL COMMENT '操作者userId',
  `operationByUser` varchar(255) CHARACTER SET utf8mb4 DEFAULT NULL COMMENT '操作者用户名',
  `operationAt` varchar(255) CHARACTER SET utf8mb4 DEFAULT NULL COMMENT '操作时间; E.g: 2021-05-28T10:24:54+08:00 ',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=44 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
INSERT INTO `_group` (`id`, `groupId`, `groupLastId`, `groupPath`, `groupName`, `groupDeptName`, `groupAllName`, `principalId`, `headId`, `leadId`, `groupDesc`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (1, '超级管理员', '超级管理员', NULL, '超级管理员', '超级管理员', '超级管理员', NULL, NULL, NULL, NULL, 'insert', NULL, NULL, NULL);
INSERT INTO `_group` (`id`, `groupId`, `groupLastId`, `groupPath`, `groupName`, `groupDeptName`, `groupAllName`, `principalId`, `headId`, `leadId`, `groupDesc`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (27, '总公司', '总公司', NULL, '总公司', '总公司', '总公司', NULL, NULL, NULL, NULL, 'insert', NULL, NULL, NULL);
INSERT INTO `_group` (`id`, `groupId`, `groupLastId`, `groupPath`, `groupName`, `groupDeptName`, `groupAllName`, `principalId`, `headId`, `leadId`, `groupDesc`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (28, '总公司-ZB', 'ZB', '总公司', '集团总部', '集团总部', '总公司-集团总部', NULL, NULL, NULL, NULL, 'insert', 'admin', '超级管理员', '2024-03-18T14:43:29+08:00');
INSERT INTO `_group` (`id`, `groupId`, `groupLastId`, `groupPath`, `groupName`, `groupDeptName`, `groupAllName`, `principalId`, `headId`, `leadId`, `groupDesc`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (29, '总公司-ZX', 'ZX', '总公司', '在线教育', '在线教育', '总公司-在线教育', NULL, NULL, NULL, NULL, 'insert', 'admin', '超级管理员', '2024-03-18T14:43:49+08:00');
INSERT INTO `_group` (`id`, `groupId`, `groupLastId`, `groupPath`, `groupName`, `groupDeptName`, `groupAllName`, `principalId`, `headId`, `leadId`, `groupDesc`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (30, '总公司-K12', 'K12', '总公司', 'K12教育', 'K12教育', '总公司-K12教育', NULL, NULL, NULL, NULL, 'jhUpdate', 'admin', '超级管理员', '2024-03-18T21:52:17+08:00');
INSERT INTO `_group` (`id`, `groupId`, `groupLastId`, `groupPath`, `groupName`, `groupDeptName`, `groupAllName`, `principalId`, `headId`, `leadId`, `groupDesc`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (31, '总公司-YF', 'YF', '总公司', '研发生产公司', '研发生产公司', '总公司-研发生产公司', NULL, NULL, NULL, NULL, 'insert', 'admin', '超级管理员', '2024-03-18T14:44:43+08:00');
INSERT INTO `_group` (`id`, `groupId`, `groupLastId`, `groupPath`, `groupName`, `groupDeptName`, `groupAllName`, `principalId`, `headId`, `leadId`, `groupDesc`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (32, '总公司-XSGZ', 'XSGZ', '总公司', '广州销售公司', '广州销售公司', '总公司-广州销售公司', NULL, NULL, NULL, NULL, 'insert', 'admin', '超级管理员', '2024-03-18T14:45:46+08:00');
INSERT INTO `_group` (`id`, `groupId`, `groupLastId`, `groupPath`, `groupName`, `groupDeptName`, `groupAllName`, `principalId`, `headId`, `leadId`, `groupDesc`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (33, '总公司-ZB-HR', 'HR', '总公司-ZB', '人事部', '人事部', '总公司-集团总部-人事部', NULL, NULL, NULL, NULL, 'insert', 'admin', '超级管理员', '2024-03-18T14:47:09+08:00');
INSERT INTO `_group` (`id`, `groupId`, `groupLastId`, `groupPath`, `groupName`, `groupDeptName`, `groupAllName`, `principalId`, `headId`, `leadId`, `groupDesc`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (34, '总公司-ZB-FD', 'FD', '总公司-ZB', '财务部', '财务部', '总公司-集团总部-财务部', NULL, NULL, NULL, NULL, 'insert', 'admin', '超级管理员', '2024-03-18T14:48:02+08:00');
INSERT INTO `_group` (`id`, `groupId`, `groupLastId`, `groupPath`, `groupName`, `groupDeptName`, `groupAllName`, `principalId`, `headId`, `leadId`, `groupDesc`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (35, '总公司-ZB-SYS', 'SYS', '总公司-ZB', '信息技术部', '信息技术部', '总公司-集团总部-信息技术部', NULL, NULL, NULL, NULL, 'insert', 'admin', '超级管理员', '2024-03-18T14:48:20+08:00');
INSERT INTO `_group` (`id`, `groupId`, `groupLastId`, `groupPath`, `groupName`, `groupDeptName`, `groupAllName`, `principalId`, `headId`, `leadId`, `groupDesc`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (36, '总公司-XSGZ-HR', 'HR', '总公司-XSGZ', '人事部', '人事部', '总公司-广州销售公司-人事部', NULL, NULL, NULL, NULL, 'insert', 'admin', '超级管理员', '2024-03-18T14:49:00+08:00');
INSERT INTO `_group` (`id`, `groupId`, `groupLastId`, `groupPath`, `groupName`, `groupDeptName`, `groupAllName`, `principalId`, `headId`, `leadId`, `groupDesc`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (37, '总公司-YF-HR', 'HR', '总公司-YF', '人事部', '人事部', '总公司-研发生产公司-人事部', NULL, NULL, NULL, NULL, 'insert', 'admin', '超级管理员', '2024-03-18T14:49:12+08:00');
INSERT INTO `_group` (`id`, `groupId`, `groupLastId`, `groupPath`, `groupName`, `groupDeptName`, `groupAllName`, `principalId`, `headId`, `leadId`, `groupDesc`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (38, '总公司-K12-HR', 'HR', '总公司-K12', '人事部', '人事部', '总公司-K12教育-人事部', NULL, NULL, NULL, NULL, 'insert', 'admin', '超级管理员', '2024-03-18T14:49:23+08:00');
INSERT INTO `_group` (`id`, `groupId`, `groupLastId`, `groupPath`, `groupName`, `groupDeptName`, `groupAllName`, `principalId`, `headId`, `leadId`, `groupDesc`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (39, '总公司-ZX-HR', 'HR', '总公司-ZX', '人事部', '人事部', '总公司-在线教育-人事部', NULL, NULL, NULL, NULL, 'insert', 'admin', '超级管理员', '2024-03-18T19:53:01+08:00');
INSERT INTO `_group` (`id`, `groupId`, `groupLastId`, `groupPath`, `groupName`, `groupDeptName`, `groupAllName`, `principalId`, `headId`, `leadId`, `groupDesc`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (40, '总公司-K12-FD', 'FD', '总公司-K12', '财务部', '财务部', '总公司-K12教育-财务部', NULL, NULL, NULL, NULL, 'insert', 'admin', '超级管理员', '2024-03-18T19:53:18+08:00');
INSERT INTO `_group` (`id`, `groupId`, `groupLastId`, `groupPath`, `groupName`, `groupDeptName`, `groupAllName`, `principalId`, `headId`, `leadId`, `groupDesc`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (41, '总公司-XSGZ-FD', 'FD', '总公司-XSGZ', '财务部', '财务部', '总公司-广州销售公司-财务部', NULL, NULL, NULL, NULL, 'insert', 'admin', '超级管理员', '2024-03-18T19:53:30+08:00');
INSERT INTO `_group` (`id`, `groupId`, `groupLastId`, `groupPath`, `groupName`, `groupDeptName`, `groupAllName`, `principalId`, `headId`, `leadId`, `groupDesc`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (42, '总公司-XSGZ-SA', 'SA', '总公司-XSGZ', '销售部', '销售部', '总公司-广州销售公司-销售部', NULL, NULL, NULL, NULL, 'insert', 'admin', '超级管理员', '2024-03-18T19:53:46+08:00');
INSERT INTO `_group` (`id`, `groupId`, `groupLastId`, `groupPath`, `groupName`, `groupDeptName`, `groupAllName`, `principalId`, `headId`, `leadId`, `groupDesc`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (43, '总公司-XSGZ-MA', 'MA', '总公司-XSGZ', '市场部', '市场部', '总公司-广州销售公司-市场部', NULL, NULL, NULL, NULL, 'insert', 'admin', '超级管理员', '2024-03-18T19:53:57+08:00');


-- ----------------------------
-- Table structure for _role
-- ----------------------------
DROP TABLE IF EXISTS `_role`;
CREATE TABLE `_role` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `roleId` varchar(255) DEFAULT NULL COMMENT 'roleId',
  `roleName` varchar(255) DEFAULT NULL COMMENT 'role name',
  `roleType` varchar(255) DEFAULT NULL COMMENT '职务类型; 正式职务, 临时职务',
  `roleDesc` varchar(255) DEFAULT NULL COMMENT 'role desc',
  `operation` varchar(255) DEFAULT 'insert' COMMENT '操作; insert, update, jhInsert, jhUpdate, jhDelete jhRestore',
  `operationByUserId` varchar(255) DEFAULT NULL COMMENT '操作者userId',
  `operationByUser` varchar(255) DEFAULT NULL COMMENT '操作者用户名',
  `operationAt` varchar(255) DEFAULT NULL COMMENT '操作时间; E.g: 2021-05-28T10:24:54+08:00 ',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uniq_roleId` (`roleId`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=62 DEFAULT CHARSET=utf8mb4 COMMENT='角色表; 软删除未启用;';
INSERT INTO `_role` (`id`, `roleId`, `roleName`, `roleType`, `roleDesc`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (54, '总公司-ZB-HR|HR管理员', 'HR管理员', '正式角色', NULL, 'insert', 'admin', '超级管理员', '2024-03-18T20:44:03+08:00');
INSERT INTO `_role` (`id`, `roleId`, `roleName`, `roleType`, `roleDesc`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (55, '总公司-ZB-HR|招聘角色', '招聘角色', '正式角色', NULL, 'insert', 'admin', '超级管理员', '2024-03-18T20:44:19+08:00');
INSERT INTO `_role` (`id`, `roleId`, `roleName`, `roleType`, `roleDesc`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (56, '总公司-ZB-HR|资料员角色', '资料员角色', '正式角色', NULL, 'insert', 'admin', '超级管理员', '2024-03-18T20:44:31+08:00');
INSERT INTO `_role` (`id`, `roleId`, `roleName`, `roleType`, `roleDesc`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (57, '总公司-ZB-FD|财务管理员', '财务管理员', '正式角色', NULL, 'insert', 'admin', '超级管理员', '2024-03-18T20:44:50+08:00');
INSERT INTO `_role` (`id`, `roleId`, `roleName`, `roleType`, `roleDesc`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (59, '总公司-ZB-FD|会计角色', '会计角色', '正式角色', NULL, 'insert', 'admin', '超级管理员', '2024-03-18T20:45:10+08:00');
INSERT INTO `_role` (`id`, `roleId`, `roleName`, `roleType`, `roleDesc`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (60, '总公司-ZB-FD|出纳角色', '出纳角色', '正式角色', NULL, 'insert', 'admin', '超级管理员', '2024-03-18T20:45:27+08:00');
INSERT INTO `_role` (`id`, `roleId`, `roleName`, `roleType`, `roleDesc`, `operation`, `operationByUserId`, `operationByUser`, `operationAt`) VALUES (61, '总公司-ZB-SYS|信息管理员', '信息管理员', '正式角色', NULL, 'insert', 'admin', '超级管理员', '2024-03-18T20:45:53+08:00');

DROP VIEW IF EXISTS `_view01_user`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `_view01_user` AS select `_user`.`id` AS `id`,`_user`.`idSequence` AS `idSequence`,`_user`.`userId` AS `userId`,`_user`.`username` AS `username`,`_user`.`phoneNumber` AS `phoneNumber`,`_user`.`email` AS `email`,`_user`.`userStatus` AS `userStatus`,`_user`.`hrOrgRoleList` AS `hrOrgRoleList`,`_user`.`qiweiId` AS `qiweiId`,`_user`.`wechatId` AS `wechatId`,`_user`.`userConfig` AS `userConfig`,`_user`.`password` AS `password`,`_user`.`md5Salt` AS `md5Salt`,`_user`.`clearTextPassword` AS `clearTextPassword`,`_user`.`operation` AS `operation`,`_user`.`operationByUserId` AS `operationByUserId`,`_user`.`operationByUser` AS `operationByUser`,`_user`.`operationAt` AS `operationAt` from `_user`