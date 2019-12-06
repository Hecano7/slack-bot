'use strict';
const axios = require('axios');
var moment = require('moment');
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
function calculateDashboardStandupsData(standups, students) {
  const todaysStandups = standups.filter(standup => {
    return new Date(standup.date) > todayMidnight;
  });
  const uniqueStandupsToday = [...new Set(todaysStandups.map(standup => {
    return standup.slack_id;
  }))];
  const delinquents = students.filter(student => {
    return !uniqueStandupsToday.some(slackId => {
      return student.slack_id === slackId;
    });
  });
  const todaysStandupPercent = Math.round((uniqueStandupsToday.length /
    students.length) * 100);
  return {
    summary: [
      {
        featured: `${todaysStandupPercent}%`,
        fraction: `${uniqueStandupsToday.length} / ${students.length}`,
        footer: 'today',
      },
    ],
    delinquents,
  };
}
function calculateDashboardCheckinData(activeCheckins, students) {
  // assumes a student cannot have more than one active checkin
  // u gotta filter activeCheckins to be 'activeCheckinsToday'
  const checkinPercent =
    Math.round((activeCheckins.length / students.length) * 100);
  const absentees = students.filter(student => {
    return !activeCheckins.some(checkin => {
      return student.slack_id === checkin.slack_id;
    });
  });
  return {
    summary: [
      {
        featured: `${checkinPercent}%`,
        fraction: `${activeCheckins.length} / ${students.length}`,
        footer: 'checked in',
      },
    ],
    delinquents: absentees,
  };
}

function calculateAbsentees(activeCheckins, students) {
  // assumes a student cannot have more than one active checkin
  var absentees = students.filter(student => {
    return !activeCheckins.some(checkin => {
      return student.slack_id === checkin.slack_id;
    });
  });
  absentees.map(absentee => {
    absentee.absent = true;
    return absentee;
  })
  return absentees;
}

function calculateIndividualStandupsData(standups) {
  if (standups.length === 0) { return 0; }
  // standups completed in the last seven days
  const standupsLastSevenDays = standups.filter(standup => {
    return new Date(standup.date) > sevenDaysAgoMidnight;
  });
  const standupsLastSevenDaysDates = standupsLastSevenDays.map(standup => {
    const standupDate = new Date(standup.date);
    return (
    `${standupDate.getFullYear()} - ${standupDate.getMonth() + 1} - ${standupDate.getDate()}`
    );
  });
  const uniqueStandupsLastSevenDays =
    [...new Set(standupsLastSevenDaysDates)];

    const weekOfStandupsPercent =
    Math.round((uniqueStandupsLastSevenDays.length / 7) * 100);
  // standups completed during entire enrollment (assuming standup submitted on day 1)
  const dayOne = new Date(standups[0].date);

  const dayOneMidnight = midnight(dayOne);
  const totalDaysEnrolled = Math.round((tomorrowMidnight - dayOneMidnight)/ millisecondsToDays);
  const standupsDates = standups.map(standup => {
    const standupDate = new Date(standup.date);
    return (
      `${standupDate.getFullYear()}-${standupDate.getMonth() + 1}-${standupDate.getDate()}`);
  });

  const uniqueDaysWithStandups = [...new Set(standupsDates)];
  const averageStandupPercent = Math.round((uniqueDaysWithStandups.length / totalDaysEnrolled) * 100);
  return ([
    {
      // featured: `${weekOfStandupsPercent}%`,
      featured: `${uniqueStandupsLastSevenDays.length} / 7`,
      footer: 'Standups completed past 7 days',
    },
    {
      featured: `${averageStandupPercent}%`,
      fraction: `${uniqueDaysWithStandups.length} / ${totalDaysEnrolled}`,
      footer: 'Standups completed total average',
    },
  ]);
}

function formatDate(date){

  var dd = date.getDate();
  var mm = date.getMonth()+1;
  var yyyy = date.getFullYear();
  if(dd<10) {dd='0'+dd}
  if(mm<10) {mm='0'+mm}
  date = mm+'/'+dd+'/'+yyyy;
  return date
}

function Last7Days () {
  var result = [];
  for (var i=0; i<7; i++) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      result.push( formatDate(d) )
  }
  return(result);
}

  var hoy = moment().format(); 
console.log(hoy);
  var sevenDaysFromToday = Last7Days(hoy);
  console.log(sevenDaysFromToday);

  var order = [];
  
  sevenDaysFromToday.map(obj => {
    var num = obj.slice(3,5);
  order.push(num);
});

let indexes = [];

function passed7Days (array) {
    for (var i = 0; i < array.length; i++) {
      var slice = array[i].slice(0, 10);
      var split = slice.split("-");
      split.toString();
      if (order.includes(split[2])){
          indexes.push(i);
        }
      }
    }

    console.log("indexes",indexes);
  

    // let information =["2019-12-05T18:22:13Z", "2019-12-05T18:17:48Z", "2019-11-26T22:47:07Z", "2019-11-26T22:33:03Z", "2019-11-25T01:20:34Z", "2019-11-21T17:55:01Z", "2019-11-21T17:52:22Z", "2019-11-21T17:52:11Z", "2019-11-21T17:51:59Z", "2019-11-21T17:51:47Z", "2019-11-21T02:57:14Z", "2019-11-21T02:56:37Z", "2019-11-21T02:55:46Z", "2019-11-21T02:53:35Z", "2019-11-21T02:53:22Z", "2019-11-21T02:44:37Z", "2019-11-21T02:34:16Z", "2019-11-21T02:30:47Z", "2019-11-21T02:27:56Z", "2019-11-18T19:16:15Z", "2019-11-17T18:35:47Z", "2019-11-17T01:45:49Z", "2019-11-16T00:25:57Z", "2019-11-15T22:44:23Z", "2019-11-12T20:45:48Z", "2019-11-12T20:42:50Z", "2019-11-12T20:16:53Z", "2019-11-12T20:15:08Z", "2019-11-12T20:13:14Z", "2019-11-10T05:36:39Z"];
    //   passed7Days (information);
    //   console.log("order",order);

  function calculateIndividualCommitData() {
    return axios.get(`https://api.github.com/users/Hecano7/events`)
    .then(response => {
      let commitDate = [];
      response.data.map(data => {
         if(data.created_at) {
        commitDate.push(data.created_at);
      }
    })
    console.log("response.data",response.data);
    passed7Days(commitDate);
    var position = [];
    let commitCount = [];
    indexes.map(num => {
      commitCount.push(response.data[num]);
    })
    commitCount.map(data => {
      console.log(data);
        if(data.payload.commits !== undefined) {
      position.push(data.payload.commits);
      }
    })
      console.log("commitDate",commitDate);
      // console.log("position",position);
      // console.log("position",position);
       console.log("commitCount",commitCount);
      console.log("NUMBER",
      position.reduce((a, b) => a + b, 0))
      return position.length;
    })
    .catch(error => console.error(error));
 }

 calculateIndividualCommitData();

function calculateIndividualCheckinData(checkins) {
  if (checkins.length === 0) { return null; }
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
    weeklyAverageHours = Math.round((totalHours / totalDaysEnrolled) * 7);
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

  let autoCheckoutsLastSevenDays =
      completedCheckinsLastSevenDays.reduce((accumulator, checkin) => {
       if(checkin.auto_checkout){accumulator++};
       return accumulator;
    }, 0);
  return ([
    {
      featured: `${timeSpentLastSevenDays}`,
      measurement: 'hrs',
      footer: 'Time in class past 7 days',
    }, {
      featured: `${weeklyAverageHours}`,
      measurement: 'hrs',
      footer: 'Time in class weekly average',
    }, {
      featured: `${totalHours}`,
      measurement: 'hrs',
      footer: 'Time in class total hours',
    }, {
      featured: `${autoCheckoutsLastSevenDays}`,
      measurement: '',
      footer: 'weekly auto-checkouts'
    }
  ]);
}
function calculateIndividualWakatimeData(wt) {
  const wakatimeDates = wt.map(wakatime => {
    const wakatimeDate = new Date(wakatime.date);
    let wakatimedateobj = new Object();
      wakatimedateobj.date = `${wakatimeDate.getFullYear()}-
      ${wakatimeDate.getMonth() + 1}-
      ${wakatimeDate.getDate()}`
      wakatimedateobj.duration = `${wakatime.duration}`
      return wakatimedateobj
  });

  //filters out duplicate object entries
  function getUniqueDates(arr, comp) {
    const unique = arr
         .map(e => e[comp])
       // store the keys of the unique objects
      .map((e, i, final) => final.indexOf(e) === i && i)
      // eliminate the dead keys & store unique objects
      .filter(e => arr[e]).map(e => arr[e]);
     return unique;
  }
let wakatimes = getUniqueDates(wakatimeDates,'date')
  if (wakatimes.length == 0) { return null; }
 // total time spent in classroom
  let totalSeconds = wakatimes.reduce((accumulator, wakatime) => {
    return accumulator + parseInt(wakatime.duration);
  }, 0);

  let totalHours = Math.round(totalSeconds) / (60 * 60);

  // weekly average = daily average * 7, but only if student has already been
  // enrolled for at least one week
  const dayOne = new Date(wakatimes[0].date);
  const dayOneMidnight = new Date(
    `${dayOne.getFullYear()}-
    ${dayOne.getMonth() + 1}-
    ${dayOne.getDate()}`
  );
  const totalDaysEnrolled =
    Math.round((tomorrowMidnight - dayOneMidnight) / millisecondsToDays);
  let weeklyAverageHours;
  if (totalDaysEnrolled <= 7) {
    weeklyAverageHours = totalHours;
  } else {
    weeklyAverageHours = Math.round((totalHours / totalDaysEnrolled) * 7);
  }

  // time spent in coding in the last seven days
  const wakatimesLastSevenDays = wakatimes.filter(wakatime => {
    return new Date(wakatime.date) > sevenDaysAgoMidnight;
  });

  let timeSpentLastSevenDays = wakatimesLastSevenDays.reduce((accumulator, wakatime) => {
    return accumulator + parseInt(wakatime.duration);
  }, 0);

  timeSpentLastSevenDays = Math.round(timeSpentLastSevenDays) / (60 * 60);

  return ([
    {
      featured: `${timeSpentLastSevenDays.toFixed(2)}`,
      measurement: 'hrs',
      footer: 'Time coding past 7 days',
    }, {
      featured: `${weeklyAverageHours.toFixed(2)}`,
      measurement: 'hrs',
      footer: 'Time coding weekly average',
    }, {
      featured: `${totalHours.toFixed(2)}`,
      measurement: 'hrs',
      footer: 'Time coding total hours',
    },
  ]);
}
module.exports = {
  calculateAbsentees,
  calculateDashboardCheckinData,
  calculateDashboardStandupsData,
  calculateIndividualStandupsData,
  calculateIndividualCheckinData,
  calculateIndividualWakatimeData,
  // calculateIndividualCommitData
};
