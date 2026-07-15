package com.aiwebchat.service;

import com.aiwebchat.dto.AttachmentVO;
import org.springframework.web.multipart.MultipartFile;

public interface FileService {

    /**
     * 上传文件，返回附件信息（含访问 URL、缩略图等）。
     */
    AttachmentVO upload(MultipartFile file);
}
