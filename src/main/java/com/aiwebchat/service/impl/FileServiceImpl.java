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

    private static final Set<String> IMAGE_EXTENSIONS = Set.of(
            ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"
    );

    @Override
    public AttachmentVO upload(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw BusinessException.badRequest("文件不能为空");
        }

        try {
            String originalName = file.getOriginalFilename();
            if (originalName == null) {
                originalName = "unnamed";
            }

            String ext = extractExtension(originalName);
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
            throw new RuntimeException("文件上传失败: " + e.getMessage());
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
