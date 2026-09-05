package com.campusfleamarket.util;

import com.campusfleamarket.config.AppProperties;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.Base64;

/**
 * RSA 工具，对应原 utils/rsa.js：
 * - 私钥持久化于 keys/rsa_private.pem（PKCS8 PEM），与前端 jsencrypt 公钥配对
 * - 解密使用 PKCS#1 v1.5 填充（与 Node crypto.RSA_PKCS1_PADDING / jsencrypt 默认一致）
 * - 解密失败返回 null（与原 decryptField 行为一致）
 */
@Component
public class RsaUtil {

    private final AppProperties props;
    private PrivateKey privateKey;
    private String publicKeyPem;

    public RsaUtil(AppProperties props) {
        this.props = props;
    }

    private File keyFile(String name) {
        File file = new File(props.getRsaPrivateKeyPath());
        File base = file.isAbsolute() ? file.getParentFile() : new File(System.getProperty("user.dir"), props.getRsaPrivateKeyPath()).getParentFile();
        return new File(base, name);
    }

    private PrivateKey privateKey() {
        if (privateKey != null) return privateKey;
        try {
            File file = keyFile("rsa_private.pem");
            String pem = Files.readString(file.toPath(), StandardCharsets.UTF_8);
            String base64 = pem.replaceAll("-----BEGIN (RSA )?PRIVATE KEY-----", "")
                    .replaceAll("-----END (RSA )?PRIVATE KEY-----", "")
                    .replaceAll("\\s", "");
            PKCS8EncodedKeySpec spec = new PKCS8EncodedKeySpec(Base64.getDecoder().decode(base64));
            privateKey = KeyFactory.getInstance("RSA").generatePrivate(spec);
            return privateKey;
        } catch (Exception e) {
            throw new IllegalStateException("RSA 私钥加载失败: " + e.getMessage(), e);
        }
    }

    /**
     * 解密前端用公钥加密的字段（base64 密文），失败返回 null（与原 decryptField 一致）。
     */
    public String decryptField(String cipherBase64) {
        if (cipherBase64 == null || cipherBase64.isEmpty()) return null;
        try {
            Cipher cipher = Cipher.getInstance("RSA/ECB/PKCS1Padding");
            cipher.init(Cipher.DECRYPT_MODE, privateKey());
            byte[] decrypted = cipher.doFinal(Base64.getDecoder().decode(cipherBase64));
            return new String(decrypted, StandardCharsets.UTF_8);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * 获取公钥 PEM 原文（供 GET /api/auth/public-key 下发前端）。
     */
    public String getPublicKey() {
        if (publicKeyPem != null) return publicKeyPem;
        try {
            publicKeyPem = Files.readString(keyFile("rsa_public.pem").toPath(), StandardCharsets.UTF_8).trim();
            return publicKeyPem;
        } catch (Exception e) {
            throw new IllegalStateException("RSA 公钥加载失败: " + e.getMessage(), e);
        }
    }
}
