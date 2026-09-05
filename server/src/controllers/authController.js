const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { success, error } = require('../utils/response');
const { getPublicKey, decryptField } = require('../utils/rsa');
require('dotenv').config();

// 获取 RSA 公钥（前端加密密码/手机号等敏感字段用）
exports.publicKey = (req, res) => {
  res.json(success({ publicKey: getPublicKey() }));
};

// 用户注册
exports.register = async (req, res) => {
  try {
    const { username, nickname, studentId, college } = req.body;
    // 密码/手机号为前端公钥加密的密文，先解密再校验
    const password = decryptField(req.body.password);
    const phone = req.body.phone ? decryptField(req.body.phone) : req.body.phone;

    if (password === null || phone === null) {
      return res.status(400).json(error('数据解密失败，请刷新页面重试'));
    }
    if (!username || !password) {
      return res.status(400).json(error('用户名和密码不能为空'));
    }
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json(error('用户名长度3-20个字符'));
    }
    if (password.length < 6 || password.length > 20) {
      return res.status(400).json(error('密码长度6-20个字符'));
    }

    const existing = await User.findOne({ where: { username } });
    if (existing) {
      return res.status(400).json(error('用户名已存在'));
    }

    const user = await User.create({
      username,
      password,
      nickname: nickname || username,
      phone,
      studentId,
      college,
      role: 'user',
      status: 1
    });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || '7d' }
    );

    res.json(success({ token, user }, '注册成功'));
  } catch (err) {
    res.status(500).json(error('注册失败'));
  }
};

// 用户登录
exports.login = async (req, res) => {
  try {
    const { username } = req.body;
    // 密码为前端公钥加密的密文，先解密再比对
    const password = decryptField(req.body.password);

    if (password === null) {
      return res.status(400).json(error('数据解密失败，请刷新页面重试'));
    }
    if (!username || !password) {
      return res.status(400).json(error('用户名和密码不能为空'));
    }

    const user = await User.findOne({ where: { username } });
    if (!user) {
      return res.status(400).json(error('用户名或密码错误'));
    }

    if (user.status === 0) {
      return res.status(403).json(error('账号已被禁用，请联系管理员'));
    }

    if (!user.comparePassword(password)) {
      return res.status(400).json(error('用户名或密码错误'));
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || '7d' }
    );

    res.json(success({ token, user }, '登录成功'));
  } catch (err) {
    res.status(500).json(error('登录失败'));
  }
};

// 获取当前用户信息
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json(error('用户不存在'));
    }
    res.json(success(user));
  } catch (err) {
    res.status(500).json(error('获取信息失败'));
  }
};

// 更新用户信息
exports.updateProfile = async (req, res) => {
  try {
    const { nickname, avatar, email, studentId, college } = req.body;
    const data = { nickname, avatar, email, studentId, college };

    // 手机号：前端对非空值做公钥加密，空字符串表示用户显式清空，未提供则保持原值不更新
    const phoneRaw = req.body.phone;
    if (phoneRaw === '' || phoneRaw === null) {
      data.phone = null; // 显式清空
    } else if (phoneRaw !== undefined) {
      const phone = decryptField(phoneRaw); // 密文 → 明文
      if (phone === null) {
        return res.status(400).json(error('数据解密失败，请刷新页面重试'));
      }
      data.phone = phone;
    }
    // phoneRaw === undefined：请求未携带 phone 字段 → 不更新，保持数据库原值

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json(error('用户不存在'));
    }

    await user.update(data);
    res.json(success(user, '更新成功'));
  } catch (err) {
    console.error('[updateProfile]', err);
    res.status(500).json(error('更新失败'));
  }
};

// 修改密码
exports.changePassword = async (req, res) => {
  try {
    // 原密码/新密码均为前端公钥加密的密文，先解密再校验
    const oldPassword = decryptField(req.body.oldPassword);
    const newPassword = decryptField(req.body.newPassword);
    if (newPassword === null || oldPassword === null) {
      return res.status(400).json(error('数据解密失败，请刷新页面重试'));
    }
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json(error('新密码长度不能少于6位'));
    }

    const user = await User.findByPk(req.user.id);
    if (!user.comparePassword(oldPassword)) {
      return res.status(400).json(error('原密码错误'));
    }

    user.password = newPassword;
    await user.save();
    res.json(success(null, '密码修改成功'));
  } catch (err) {
    res.status(500).json(error('修改密码失败'));
  }
};
