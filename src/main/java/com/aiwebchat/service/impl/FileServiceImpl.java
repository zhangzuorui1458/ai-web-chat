package com.aiwebchat.service.impl;

import com.aiwebchat.dto.AttachmentVO;
import com.aiwebchat.exception.BusinessException;
import com.aiwebchat.service.FileService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
public class FileServiceImpl implements FileService {

    @Value("${app.storage.upload-dir:./uploads}")
    private String uploadDir;

    private static final long MAX_FILE_SIZE = 20 * 1024 * 1024L; // 20MB

    // 允许的文件扩展名白名单
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp",
            ".mp3", ".m4a", ".aac", ".wav",
            ".mp4", ".webm",
            ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
            ".txt", ".md", ".csv",
            ".zip", ".rar", ".7z"
    );

    // 允许的图片扩展名（用于判断 isImage）
    private static final Set<String> IMAGE_EXTENSIONS = Set.of(
            ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"
    );

    @Override
    public AttachmentVO upload(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw BusinessException.badRequest("文件不能为空");
        }

        // 文件大小校验（服务端防御，不依赖 Spring 配置）
        if (file.getSize() > MAX_FILE_SIZE) {
            throw BusinessException.badRequest("文件大小不能超过 20MB");
        }

        try {
            String originalName = file.getOriginalFilename();
            if (originalName == null) {
                originalName = "unnamed";
            }

            // 清洗原始文件名：只保留文件名部分，去除路径穿越
            originalName = originalName.replace("\\", "/");
            int lastSlash = originalName.lastIndexOf('/');
            if (lastSlash >= 0) {
                originalName = originalName.substring(lastSlash + 1);
            }

            String ext = extractExtension(originalName).toLowerCase();

            // 扩展名白名单校验
            if (!ALLOWED_EXTENSIONS.contains(ext)) {
                throw BusinessException.badRequest("不支持的文件类型: " + ext);
            }

            String storedName = UUID.randomUUID().toString().replace("-", "") + ext;
            String dateDir = java.time.LocalDate.now().toString();

            // 必须使用绝对路径：MultipartFile.transferTo(File) 传入相对路径时，
            // Tomcat 的 ApplicationPart.write 会将其相对于 Tomcat 临时目录解析，
            // 导致 FileNotFoundException。此处统一转为绝对路径。
            Path dirPath = Paths.get(uploadDir, dateDir).toAbsolutePath();
            Files.createDirectories(dirPath);

            Path targetPath = dirPath.resolve(storedName).toAbsolutePath();

            // 使用 Files.copy 直接复制流，彻底规避 Tomcat 临时目录 rename 逻辑
            try (InputStream in = file.getInputStream()) {
                Files.copy(in, targetPath, StandardCopyOption.REPLACE_EXISTING);
            }

            // 数据库与前端使用相对 URL，由 WebConfig 静态资源映射 /uploads/** 提供
            String urlPath = "/uploads/" + dateDir + "/" + storedName;
            boolean isImage = IMAGE_EXTENSIONS.contains(ext.toLowerCase());

            log.info("文件上传成功: {} -> {}", originalName, targetPath);

            return AttachmentVO.builder()
                    .url(urlPath)
                    .name(originalName)
                    .size(file.getSize())
                    .thumbUrl(urlPath)
                    .isImage(isImage)
                    .build();
        } catch (IOException e) {
            log.error("文件上传失败", e);
            throw BusinessException.badRequest("文件上传失败，请重试");
        }
    }

    private String extractExtension(String filename) {
        int dotIdx = filename.lastIndexOf('.');
        if (dotIdx >= 0 && dotIdx < filename.length() - 1) {
            return filename.substring(dotIdx).toLowerCase();
        }
        return "";
    }
}
