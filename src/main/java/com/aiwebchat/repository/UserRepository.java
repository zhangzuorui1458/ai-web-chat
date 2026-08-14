package com.aiwebchat.repository;

import com.aiwebchat.dto.UserVO;
import com.aiwebchat.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

    @Query("select u from User u where lower(u.username) like lower(concat('%', :keyword, '%')) " +
            "or lower(u.nickname) like lower(concat('%', :keyword, '%'))")
    List<User> searchByKeyword(@Param("keyword") String keyword);

    // ==================== 批量查询（N+1 优化） ====================

    @Query("select new com.aiwebchat.dto.UserVO(u.id, u.username, u.nickname, u.avatar, u.signature) " +
            "from User u where u.id in :ids")
    List<UserVO> findVOsByIds(@Param("ids") List<Long> ids);
}
