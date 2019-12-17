'use strict';

const today = new Date();

function offsetDate(initialDate, dayOffset) {
  return new Date(initialDate.setDate(initialDate.getDate() + dayOffset));
}

function midnight(date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
}

const todayMidnight = midnight(new Date(today));
const tomorrowMidnight = midnight(offsetDate(new Date(today), 1));
const sevenDaysAgoMidnight = midnight(offsetDate(new Date(today), -6));

const millisecondsToHours = 1000 * 60 * 60;
const millisecondsToDays = 1000 * 60 * 60 * 24;

module.exports = function(Checkin) {
  Checkin.getBySlackId = function(slackId, cb) {
    Checkin.find({where: {slack_id: slackId}})
      .then(result => {
        cb(null, result);
      })
      .catch(err => console.log(err));
  };

  Checkin.active = function(cb) {
    Checkin.find({where: {checkout_time: null}})
      .then(result => {
        cb(null, result);
      })
      .catch(err => console.log(err));
  };

  Checkin.hoursPerWeek  = function(slackId, cb) {
    Checkin.find({where: {slack_id: slackId}})
      .then(checkins => {
        if (checkins.length === 0) {let result='no checkin information \n';cb(null,result); return}
        // total time spent in classroom
        checkins.forEach(checkin => {
          if (!checkin.checkout_time) {
            checkin.hours = (new Date() - new Date(checkin.checkin_time)) /
              millisecondsToHours;
            }
        });
        let totalHours = checkins.reduce((accumulator, checkin) => {
          return accumulator + checkin.hours;
        }, 0);
        totalHours = Math.round(totalHours);
        
        // weekly average = daily average * 7, but only if student has already been
        // enrolled for at least one week
        const dayOne = new Date(checkins[0].checkin_time);
        const dayOneMidnight = midnight(dayOne);
        const totalDaysEnrolled =
          Math.round((tomorrowMidnight - dayOneMidnight) / millisecondsToDays);
        let weeklyAverageHours;
        if (totalDaysEnrolled <= 7) {
          weeklyAverageHours = totalHours;
        } else {
          weeklyAverageHours = Math.round(totalHours / totalDaysEnrolled * 7);
        }
      
        // time spent in classroom in the last seven days
        const checkinsLastSevenDays = checkins.filter(checkin => {
          return new Date(checkin.checkin_time) > sevenDaysAgoMidnight;
        });
        let timeSpentLastSevenDays =
          checkinsLastSevenDays.reduce((accumulator, checkin) => {
            return accumulator + checkin.hours;
          }, 0);
        timeSpentLastSevenDays = Math.round(timeSpentLastSevenDays);
        //missed checkins in the last seven days
        const completedCheckinsLastSevenDays = checkins.filter(checkin => {
          return new Date(checkin.checkin_time) > sevenDaysAgoMidnight;
        });
        let missedCheckinsLastSevenDays =
            completedCheckinsLastSevenDays.reduce((accumulator, checkin) => {
             if(checkin.checkin_time && checkin.checkout_time){accumulator+=2};
             if(checkin.checkin_time && checkin.checkout_time==null){accumulator++};
             return accumulator;
          }, 0);
        missedCheckinsLastSevenDays = Math.round(14 - missedCheckinsLastSevenDays);
      
        let result = `--Missed Checkins: ${missedCheckinsLastSevenDays}\n --Hours in Class last week: ${timeSpentLastSevenDays} \n --Average Daily Hours: ${(weeklyAverageHours/7).toFixed(2)}\n --Total hours: ${totalHours} \n`;
        cb(null, result);
      })
      .catch(err => console.log(err));
  };

  Checkin.remoteMethod(
    'getBySlackId', {
      http: {
        path: '/slackId/:slack_id',
        verb: 'get',
      },
      accepts: {
        arg: 'slack_id',
        type: 'string',
        required: true,
        http: {source: 'path'},
      },
      returns: {arg: 'checkins', type: ['checkin'], root: true},
    }
  );

  Checkin.remoteMethod(
    'hoursPerWeek', {
      http: {
        path: '/slackId/:slack_id',
        verb: 'get',
      },
      accepts: {
        arg: 'slack_id',
        type: 'string',
        required: true,
        http: {source: 'path'},
      },
      returns: {arg: 'checkins', type: ['checkin'], root: true},
    }
  );

  Checkin.remoteMethod(
    'active', {
      http: {
        path: '/active',
        verb: 'get',
      },
      returns: {arg: 'data', type:['checkin'], root: true},
    }
  );
};
