const express = require("express");
const router = express.Router();
const { db } = require("../db/DbUtils");

/** 统一处理查询 */
const getCountData = async (query, params) => {
    try {
        const { err, rows } = await db.async.all(query, params);
        if (err) throw new Error(err);
        return { success: true, data: rows.length ? rows : [{ cnt: 0 }] }; // 空表返回 [{ cnt: 0 }]
    } catch (error) {
        console.error("数据库查询失败:", error);
        throw error;
    }
};

router.get("/test", (req, res) => {
    res.send("hello world");
});
router.get("/", async (req, res) => {
    let week = req.query.week;
    if (!week) return res.send({ code: 400, msg: "缺少 week 参数" });

    try {
        console.log("start right");
        //获取建筑占用率
        const { success: buildingSuccess, data: buildingRows } = await getCountData(
            "SELECT `bname` FROM `building`",
            []
        );
        let room_occupancy_rate = [];

        if (buildingSuccess) {
            const buildingNames = buildingRows.map((b) => b.bname);

            const roomCounts = await Promise.all(
                buildingNames.map((b) =>
                    getCountData("SELECT COUNT(*) AS `cnt` FROM `room` WHERE `rbuilding` = ?", [b])
                )
            );

            const roomOccupied = await Promise.all(
                buildingNames.map((b) =>
                    getCountData(
                        "SELECT COUNT(*) AS `cnt` FROM `schedule` WHERE `scbegin_week` <= ? AND `scend_week` >= ? AND `scbuilding` = ?",
                        [week, week, b]
                    )
                )
            );

            room_occupancy_rate = buildingNames.map((building, i) => ({
                building,
                rate: roomCounts[i].success && roomCounts[i].data[0].cnt !== 0 
                      ? roomOccupied[i].data[0].cnt / roomCounts[i].data[0].cnt 
                      : 0,
            }));
        }

        console.log("right3");
        //获取任务类型次数
        const { success: typeSuccess, data: typeRows } = await getCountData(
            "SELECT DISTINCT tatype FROM task",
            []
        );
        let type_count = [];

        if (typeSuccess) {
            const taskTypes = typeRows.map((t) => t.tatype);

            const typeCounts = await Promise.all(
                taskTypes.map((type) =>
                    getCountData(
                        "SELECT COUNT(*) AS cnt FROM schedule join task on task.tacode=schedule.scid WHERE scbegin_week <= ? AND scend_week >=? AND tatype = ?",
                        [week, week, type]
                    )
                )
            );

            type_count = taskTypes.map((type, i) => ({
                type,
                count: typeCounts[i].success ? typeCounts[i].data[0].cnt : 0,
            }));
        }
        console.log("right4");
        //统一返回数据
        res.send({
            code: 200,
            data: [room_occupancy_rate, type_count],
        });
    } catch (err) {
        res.send({
            code: 500,
            msg: "服务器异常",
        });
    }
});

module.exports = router;
