package controller

import (
	"database/sql"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/nonnika/pims/internal/database/dao"
	"github.com/nonnika/pims/internal/database/model"
	"github.com/nonnika/pims/internal/encode"
	"github.com/nonnika/pims/internal/jwt"
	"github.com/nonnika/pims/internal/middleware"
)

// UserController 用于处理 Users 表相关的请求
type UserController struct {
	dao           *dao.UserDao
	jwtMgr        *jwt.JManager
	loginAttempts *loginAttemptTracker
}

type registerUserRequest struct {
	Username     string  `json:"username" form:"username"`
	Password     string  `json:"password" form:"password"`
	RealName     *string `json:"real_name" form:"real_name"`
	Phone        *string `json:"phone" form:"phone"`
	RoleId       int64   `json:"role_id" form:"role_id"`
	DepartmentId int64   `json:"department_id" form:"department_id"`
}

const (
	loginFailureLimit    = 5
	loginLockoutDuration = 15 * time.Minute
	invalidLoginMessage  = "username or password is incorrect"
)

type loginAttemptTracker struct {
	mu       sync.Mutex
	limit    int
	lockout  time.Duration
	attempts map[string]loginAttempt
}

type loginAttempt struct {
	Count       int
	LockedUntil time.Time
}

func newLoginAttemptTracker(limit int, lockout time.Duration) *loginAttemptTracker {
	return &loginAttemptTracker{
		limit:    limit,
		lockout:  lockout,
		attempts: make(map[string]loginAttempt),
	}
}

func NewUserController(dao *dao.UserDao, jwtMgr *jwt.JManager) *UserController {
	return &UserController{
		dao:           dao,
		jwtMgr:        jwtMgr,
		loginAttempts: newLoginAttemptTracker(loginFailureLimit, loginLockoutDuration),
	}
}

func (u *UserController) SelectAll(ctx *gin.Context) {
	var req pageRequest
	if !bindPageRequest(ctx, &req) {
		return
	}

	rows, total, err := u.dao.SelectPage(req.Page, req.PageSize)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	respondPage(ctx, rows, total)
}

func (u *UserController) SelectById(ctx *gin.Context) {
	_id := ctx.Query("id")
	if _id == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "id is required",
		})
		return
	}
	id, err := strconv.Atoi(_id)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}
	row, err := u.dao.SelectById(id)
	if errors.Is(err, sql.ErrNoRows) {
		ctx.JSON(http.StatusNotFound, gin.H{
			"error": err.Error(),
		})
		return
	} else if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, row)
}

func (u *UserController) SelectByUserName(ctx *gin.Context) {
	_userName := ctx.Query("user_name")
	if _userName == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "user_name is required",
		})
		return
	}

	row, err := u.dao.SelectByUserName(_userName)
	if errors.Is(err, sql.ErrNoRows) {
		ctx.JSON(http.StatusNotFound, gin.H{
			"error": err.Error(),
		})
		return
	} else if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, row)
}

func (u *UserController) DeleteById(ctx *gin.Context) {
	id, err := strconv.Atoi(ctx.Query("id"))
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	affect, err := u.dao.DeleteUser(id)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{
		"affected": affect,
	})
}

func (u *UserController) Register(ctx *gin.Context) {
	var req registerUserRequest
	err := ctx.ShouldBind(&req)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}
	if req.Username == "" {
		log.Println("username is empty")
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "username is empty",
		})
		return
	}
	if req.Password == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "password is empty",
		})
		return
	}

	passwordHash, err := encode.EncodePasswd(req.Password)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	user := model.User{
		Username:     req.Username,
		PasswordHash: passwordHash,
		RealName:     normalizeUserOptionalString(req.RealName),
		Phone:        normalizeUserOptionalString(req.Phone),
		RoleId:       req.RoleId,
		DepartmentId: req.DepartmentId,
	}
	exec, err := u.dao.Insert(user)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{
		"affected": exec,
	})
}

func (u *UserController) UpdatePasswordById(ctx *gin.Context) {
	_id := ctx.Query("id")
	if _id == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "id is empty",
		})
		return
	}

	id, err := strconv.Atoi(_id)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	user, err := u.dao.SelectById(id)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "user is not exist",
		})
		return
	}

	password := ctx.PostForm("password")
	if password == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "password is empty",
		})
		return
	}

	user.PasswordHash, err = encode.EncodePasswd(password)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	cnt, err := u.dao.Update(user)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{
		"affected": cnt,
	})
}

func (u *UserController) UpdateUserNameById(ctx *gin.Context) {
	_id := ctx.Query("id")
	if _id == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "id is empty",
		})
		return
	}

	id, err := strconv.Atoi(_id)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	user, err := u.dao.SelectById(id)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "user is not exist",
		})
		return
	}

	userName := ctx.PostForm("user_name")
	if userName == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "user_name is empty",
		})
		return
	}

	user.Username = userName

	cnt, err := u.dao.Update(user)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{
		"affected": cnt,
	})
}

func (u *UserController) UpdateRoleById(ctx *gin.Context) {
	_id := ctx.Query("id")
	if _id == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "id is empty",
		})
		return
	}

	id, err := strconv.Atoi(_id)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	user, err := u.dao.SelectById(id)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "user is not exist",
		})
		return
	}

	_roleId := ctx.PostForm("role_id")
	if _roleId == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "role_id is empty",
		})
		return
	}

	roleId, err := strconv.ParseInt(_roleId, 10, 64)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	user.RoleId = roleId

	cnt, err := u.dao.Update(user)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{
		"affected": cnt,
	})
}

func (u *UserController) UpdateDepartmentById(ctx *gin.Context) {
	_id := ctx.Query("id")
	if _id == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "id is empty",
		})
		return
	}

	id, err := strconv.Atoi(_id)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	user, err := u.dao.SelectById(id)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "user is not exist",
		})
		return
	}

	_departmentId := ctx.PostForm("department_id")
	if _departmentId == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "department_id is empty",
		})
		return
	}

	departmentId, err := strconv.ParseInt(_departmentId, 10, 64)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	user.DepartmentId = departmentId

	cnt, err := u.dao.Update(user)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{
		"affected": cnt,
	})
}

func (u *UserController) UpdateRealNameById(ctx *gin.Context) {
	user, ok := u.userByQueryId(ctx)
	if !ok {
		return
	}

	var req registerUserRequest
	if !bindUserRequest(ctx, &req) {
		return
	}

	user.RealName = normalizeUserOptionalString(req.RealName)
	u.update(ctx, user)
}

func (u *UserController) UpdatePhoneById(ctx *gin.Context) {
	user, ok := u.userByQueryId(ctx)
	if !ok {
		return
	}

	var req registerUserRequest
	if !bindUserRequest(ctx, &req) {
		return
	}

	user.Phone = normalizeUserOptionalString(req.Phone)
	u.update(ctx, user)
}

func (l *loginAttemptTracker) IsLocked(key string, now time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	attempt, ok := l.attempts[key]
	if !ok {
		return false
	}
	if attempt.LockedUntil.IsZero() || !now.Before(attempt.LockedUntil) {
		if !attempt.LockedUntil.IsZero() {
			delete(l.attempts, key)
		}
		return false
	}
	return true
}

func (l *loginAttemptTracker) RecordFailure(key string, now time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	attempt := l.attempts[key]
	if !attempt.LockedUntil.IsZero() {
		if now.Before(attempt.LockedUntil) {
			return true
		}
		attempt = loginAttempt{}
	}

	attempt.Count++
	if attempt.Count >= l.limit {
		attempt.LockedUntil = now.Add(l.lockout)
	}
	l.attempts[key] = attempt
	return !attempt.LockedUntil.IsZero()
}

func (l *loginAttemptTracker) Reset(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.attempts, key)
}

func loginAttemptKey(ctx *gin.Context, username string) string {
	return strings.ToLower(strings.TrimSpace(username)) + "|" + ctx.ClientIP()
}

func respondInvalidLogin(ctx *gin.Context) {
	ctx.JSON(http.StatusUnauthorized, gin.H{
		"error":  invalidLoginMessage,
		"isTrue": false,
	})
}

func respondTooManyLoginAttempts(ctx *gin.Context) {
	ctx.JSON(http.StatusTooManyRequests, gin.H{
		"error": "too many failed login attempts",
	})
}

func (u *UserController) VerifyPassword(ctx *gin.Context) {

	username := ctx.PostForm("username")
	if username == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "username is empty",
		})
		return
	}
	attemptKey := loginAttemptKey(ctx, username)
	now := time.Now()
	if u.loginAttempts.IsLocked(attemptKey, now) {
		respondTooManyLoginAttempts(ctx)
		return
	}

	user, err := u.dao.SelectByUserName(username)
	if errors.Is(err, sql.ErrNoRows) {
		if u.loginAttempts.RecordFailure(attemptKey, now) {
			respondTooManyLoginAttempts(ctx)
			return
		}
		respondInvalidLogin(ctx)
		return
	} else if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	password := ctx.PostForm("password")
	if password == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":  "password is empty",
			"isTrue": false,
		})
		return
	}

	if !encode.CompareHashAndPassword(user.PasswordHash, password) {
		if u.loginAttempts.RecordFailure(attemptKey, now) {
			respondTooManyLoginAttempts(ctx)
			return
		}
		respondInvalidLogin(ctx)
		return
	}

	if user.Status != model.UserStatusNormal {
		ctx.JSON(http.StatusForbidden, gin.H{
			"error": "user is disabled",
		})
		return
	}

	token, err := u.jwtMgr.GenerateToken(user.Id, user.Username, user.RoleId)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to generate jwt token",
		})
		return
	}

	u.loginAttempts.Reset(attemptKey)
	ctx.JSON(http.StatusOK, gin.H{
		"user":   user,
		"isTrue": true,
		"token":  token,
	})

}

func (u *UserController) BlockById(ctx *gin.Context) {
	u.updateStatusById(ctx, model.UserStatusBlocked)
}

func (u *UserController) UnblockById(ctx *gin.Context) {
	u.updateStatusById(ctx, model.UserStatusNormal)
}

func bindUserRequest(ctx *gin.Context, req *registerUserRequest) bool {
	if err := ctx.ShouldBind(req); err != nil {
		log.Println(err)
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return false
	}

	return true
}

func (u *UserController) updateStatusById(ctx *gin.Context, status int64) {
	_id := ctx.Query("id")
	if _id == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "id is empty",
		})
		return
	}

	id, err := strconv.Atoi(_id)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	affected, err := u.dao.UpdateStatusById(id, status)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}
	if affected == 0 {
		ctx.JSON(http.StatusNotFound, gin.H{
			"error": "user is not exist",
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"affected": affected,
	})
}

func normalizeUserOptionalString(value *string) *string {
	if value == nil || *value == "" {
		return nil
	}

	return value
}

func (u *UserController) userByQueryId(ctx *gin.Context) (*model.User, bool) {
	_id := ctx.Query("id")
	if _id == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "id is empty",
		})
		return nil, false
	}

	id, err := strconv.Atoi(_id)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return nil, false
	}

	user, err := u.dao.SelectById(id)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "user is not exist",
		})
		return nil, false
	}

	return user, true
}

func (u *UserController) update(ctx *gin.Context, user *model.User) {
	cnt, err := u.dao.Update(user)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{
		"affected": cnt,
	})
}

type updateMyPasswordRequest struct {
	OldPassword string `json:"old_password" form:"old_password"`
	NewPassword string `json:"new_password" form:"new_password"`
}

func (u *UserController) UpdateMyPassword(ctx *gin.Context) {
	var req updateMyPasswordRequest
	if err := ctx.ShouldBind(&req); err != nil {
		log.Println(err)
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	if req.NewPassword == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "new_password is empty",
		})
		return
	}

	userId := currentUserId(ctx)
	if userId == 0 {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"error": "user is not authenticated",
		})
		return
	}

	user, err := u.dao.SelectById(int(userId))
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "user is not exist",
		})
		return
	}
	if user.Status != model.UserStatusNormal {
		ctx.JSON(http.StatusForbidden, gin.H{
			"error": "user is disabled",
		})
		return
	}

	// 非管理员修改自己的密码需要校验旧密码
	if !isAdmin(ctx) && !encode.CompareHashAndPassword(user.PasswordHash, req.OldPassword) {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"error": "old_password is wrong",
		})
		return
	}

	passwordHash, err := encode.EncodePasswd(req.NewPassword)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	affected, err := u.dao.UpdatePasswordById(int(userId), passwordHash)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}
	if affected == 0 {
		ctx.JSON(http.StatusNotFound, gin.H{
			"error": "user is not exist",
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"affected": affected,
	})
}

func (u *UserController) RegisterRouter(r *gin.RouterGroup) {
	r.POST("/users/verify", u.VerifyPassword)
}
func (u *UserController) RegisterAuthRouter(r *gin.RouterGroup) {
	admin := middleware.Role(model.RoleAdmin)
	r.POST("/users/register", admin, u.Register)
	r.POST("/users/selectAll", admin, u.SelectAll)
	r.GET("/users/selectById", admin, u.SelectById)
	r.GET("/users/selectByUserName", admin, u.SelectByUserName)
	r.DELETE("/users/deleteById", admin, u.DeleteById)
	r.POST("/users/UpdatePasswordById", admin, u.UpdatePasswordById)
	r.POST("/users/UpdateUserNameById", admin, u.UpdateUserNameById)
	r.POST("/users/UpdateRoleById", admin, u.UpdateRoleById)
	r.POST("/users/UpdateDepartmentById", admin, u.UpdateDepartmentById)
	r.POST("/users/UpdateRealNameById", admin, u.UpdateRealNameById)
	r.POST("/users/UpdatePhoneById", admin, u.UpdatePhoneById)
	r.POST("/users/blockById", admin, u.BlockById)
	r.POST("/users/unblockById", admin, u.UnblockById)
	r.POST("/users/updateMyPassword", u.UpdateMyPassword)
}
