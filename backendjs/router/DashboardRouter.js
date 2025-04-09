const express = require("express");
const router = express.Router();
const crypto = require('crypto');
const { db } = require("../db/DbUtils");

// 公共的课程数据处理函数
const formatCourses = (coursesResult) => {
    if (!coursesResult || !coursesResult.rows) return [];

    return coursesResult.rows.map((course) => {
        const weekday = course.day_of_week || 0;
        const weeks = [];

        if (course.beginWeek && course.endWeek) {
            for (let i = course.beginWeek; i <= course.endWeek; i++) {
                weeks.push(i);
            }
        }

        course.classroom=course.classroom.replace(/^[^#\/]*[#\/]/, '');

        return {
            id: course.scid,
            name: course.name || '未命名课程',
            teacher: course.teacher || '未分配教师',
            classroom: course.classroom || '未分配教室',
            campus: course.campus || '未知校区',
            building: course.building || '未知教学楼',
            weekday: weekday,
            slot: course.slot || '未知课次',
            weeks: weeks.length > 0 ? weeks : [1], // 默认第一周
        };
    });
};

router.get("/weekView", async (req, res) => {
    const { user, userType = 'student', week } = req.query;

    if (!user) {
        return res.status(400).send({
            code: 400,
            msg: "缺少必要参数: user"
        });
    }

    try {
        let coursesResult;

        if (userType === 'student') {
            coursesResult = await db.async.all(`
                SELECT
                    s.scid,
                    ta.taname as name,
                    r.rcampus as campus,
                    r.rbuilding as building,
                    ta.tateachername as teacher,
                    r.rname as classroom,
                    s.scday_of_week as day_of_week,
                    s.scbegin_week as beginWeek,
                    s.scend_week as endWeek,
                    s.scslot as slot
                FROM
                    schedule s
                LEFT JOIN
                    task ta ON ta.taformclassid = s.sctask
                LEFT JOIN
                    room r ON r.rid=s.scroom
                WHERE
                    FIND_IN_SET(?, ta.taformclass) > 0 
                  AND ?>=s.scbegin_week AND ?<=s.scend_week
                ORDER BY
                    s.scday_of_week, s.scbegin_time
            `, [user,week,week]);
        } else if (userType === 'teacher') {
            // 添加教师查询逻辑
            coursesResult = await db.async.all(`
                SELECT
                    s.scid,
                    ta.taname as name,
                    r.rcampus as campus,
                    r.rbuilding as building,
                    ta.tateachername as teacher,
                    r.rname as classroom,
                    s.scday_of_week as day_of_week,
                    s.scbegin_week as beginWeek,
                    s.scend_week as endWeek,
                    s.scslot as slot
                FROM
                    schedule s
                LEFT JOIN
                    task ta ON ta.taformclassid = s.sctask
                LEFT JOIN
                    room r ON r.rid=s.scroom
                WHERE 
                    s.scteacherid = ?
                  AND ?>=s.scbegin_week AND ?<=s.scend_week
                ORDER BY
                    s.scday_of_week, s.scbegin_time
            `, [parseInt(user),week,week]);
        } else {
            return res.status(400).send({
                code: 400,
                msg: "无效的用户类型"
            });
        }

        const formattedCourses = formatCourses(coursesResult);

        res.send({
            code: 200,
            data: formattedCourses,
        });
    } catch (error) {
        console.error("获取周视图数据错误:", error);
        res.status(500).send({
            code: 500,
            msg: "获取周视图数据失败",
            error: error.message,
        });
    }
});

router.get("/termView", async (req, res) => {
    const { user, userType = 'student' } = req.query;

    if (!user) {
        return res.status(400).send({
            code: 400,
            msg: "缺少必要参数: user"
        });
    }

    try {
        let coursesResult;

        if (userType === 'student') {
            coursesResult = await db.async.all(`
                SELECT
                    s.scid,
                    ta.taname as name,
                    r.rcampus as campus,
                    r.rbuilding as building,
                    ta.tateachername as teacher,
                    r.rname as classroom,
                    s.scday_of_week as day_of_week,
                    s.scbegin_week as beginWeek,
                    s.scend_week as endWeek,
                    s.scslot as slot
                FROM
                    schedule s
                        LEFT JOIN
                    task ta ON ta.taformclassid = s.sctask
                        LEFT JOIN
                    room r ON r.rid=s.scroom
                WHERE
                    FIND_IN_SET(?, ta.taformclass) > 0
                ORDER BY
                    s.scday_of_week, s.scbegin_time
            `, [user]);
        } else if (userType === 'teacher') {
            coursesResult = await db.async.all(`
                SELECT
                    s.scid,
                    ta.taname as name,
                    r.rcampus as campus,
                    r.rbuilding as building,
                    ta.tateachername as teacher,
                    r.rname as classroom,
                    s.scday_of_week as day_of_week,
                    s.scbegin_week as beginWeek,
                    s.scend_week as endWeek,
                    s.scslot as slot
                FROM
                    schedule s
                        LEFT JOIN
                    task ta ON ta.taformclassid = s.sctask
                        LEFT JOIN
                    room r ON r.rid=s.scroom
                WHERE
                    s.scteacherid = ?
                ORDER BY
                    s.scday_of_week, s.scbegin_time
            `, [parseInt(user)]);
        } else {
            return res.status(400).send({
                code: 400,
                msg: "无效的用户类型"
            });
        }

        const formattedCourses = formatCourses(coursesResult);

        res.send({
            code: 200,
            data: formattedCourses,
        });
    } catch (error) {
        console.error("获取学期视图数据错误:", error);
        res.status(500).send({
            code: 500,
            msg: "获取学期视图数据失败",
            error: error.message,
        });
    }
});

module.exports = router;