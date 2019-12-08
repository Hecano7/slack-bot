'use strict';
const path = require('path');
const axios = require('axios');
const bot = require('../bot');

let students = [];
let url = process.env.BASE_URL ? process.env.BASE_URL : 'http://localhost:3000/';

var schedule = require('node-schedule');

module.exports = (app) => {
  app.models.student.find({})
    .then(response => {
      let studentsFromDb = response;
      studentsFromDb.forEach(student => {
        addStudentToStudentsArray(student);
      });
    })
    .catch(err => console.log(err));

  app.models.student.observe('after save', (context, callback) => {
    if (context.isNewInstance) {
      addStudentToStudentsArray(context.instance);
    } else {
      updateStudentInArray(context.instance);
		}
    callback();
  })

  // #region Slack-bot Routes

  app.post('/slack/doorbell', (req, res) => {
    res.send('Ringing the doorbell');
    handleEvent(req.body, 'doorbell');
  });

  app.post('/slack/standup', (req, res) => {
    handleEvent(req.body, 'standup');
    res.status(200).send('');
  });

  app.post('/slack/stats', (req, res) => {
    handleEvent(req.body, 'stats');
    res.status(200).send('');
  });

  app.post('/slack/register', (req, res) => {
    handleEvent(req.body, 'register');
    res.status(200).send('');
  });

  app.post('/slack/wakatime', (req, res) => {
    handleEvent(req.body, 'wakatime');
    res.status(200).send('');
  });

  app.post('/slack/events', (req, res) => {
    if (req.body.type === 'url_verification') {
      res.json(req.body.challenge);
      return;
    }
    if (req.body.event.type === 'team_join') {
      res.send('OK');
      let userInfo = req.body.event.user;
      // Send POST request
      axios({
        method: 'post',
        url: process.env.API_ROOT,
        headers: {
          'X-API-Key': process.env.X_API_KEY,
          'X-User-Id': process.env.X_USER_ID,
          'X-Business-Id': process.env.X_BUSINESS_ID
        },
        data: {
          slack_id: userInfo.id,
          real_name: userInfo.real_name,
          email: userInfo.profile.email
        }
      })
        .then(function (response) {
          console.log(response);
        })
        .catch(function (error) {
          console.log(error);
        });
    }
  })

  app.post('/slack/checkin', (req, res) => {
    const { user_id, channel_id } = req.body;
    res.send(`Click the link to confirm your location to check in: ${process.env.BASE_URL}getGeo?user=${user_id}&channel=${channel_id}&checkin=true`);
  });

  app.post('/slack/checkout', (req, res) => {
    const { user_id, channel_id } = req.body;
    res.send(`Click the link to confirm your location to check out: ${process.env.BASE_URL}getGeo?user=${user_id}&channel=${channel_id}&checkin=false`);
  });

  app.post('/slack/interactive', (req, res) => {
    const body = JSON.parse(req.body.payload);
    switch (body.callback_id) {
      case 'gotin':
        handleEvent(body, 'gotin');
        res.send('Have a nice day');
        break;
      case 'latecheckout':
        if (body.actions[0].value === 'yes') {
          res.send(`Click the link to confirm your location to check out: ${process.env.BASE_URL}getGeo?user=${body.user.id}&channel=${body.channel.id}&checkin=false`);
        } else {
          handleEvent(body, 'checkout');
          res.send('Remember to check out before you leave next time.');
        }
        break;
      case 'standupResponse':
        if (body.type === 'dialog_cancellation') {
          handleEvent(body, 'cancelStandup');
        } else { // dialog_submission
          handleEvent(body, 'submitStandup');
        }
        res.send('');
				break;
			case 'registerNewStudent':
				saveNewStudentToDatabase(body.user.id, body.user.name, body.submission.wakatime_key, 'FREE');
				res.send('');
				axios.post(body.response_url, {
					'text': "You have been registered, thank you!"
				})
        break;
        case 'registerWakatimeKey':
        saveWakatimeKey(body.user.id, body.submission.wakatime_key);
        res.send('');
        axios.post(body.response_url, {
          'text': 'Your API key has been stored. Thank you!'
        });
        break;
      default:
        res.send('Not sure what you were trying to do here...');
        break;
    }
  });

  app.post('/submitGeo', (req, res) => {
    if (req.body.token == process.env.token || '0') {
      if (req.body.checkin === 'true') {
        handleEvent(req.body, 'checkin');
        res.sendStatus( 'Congratulations! You have just checked into San Diego Code School.');
      } else {
        handleEvent(req.body, 'checkout');
        res.sendStatus( 'Congratulations! You have just checked out of San Diego Code School.');
      }
    } else {
      res.sendStatus(401);
    }
  });

  app.get('/getGeo', (req, res) => {
    const { user, channel, checkin, notatschool } = req.query;
    res.render('index', { user, channel, checkin, token: process.env.token, notatschool });
  });

  app.post('/submitNotAtSchool', (req, res) => {
    if (req.body.token == process.env.token || '0'){
      if (req.body.checkin === 'true') {
        handleEvent(req.body, 'notAtSchool');
        res.sendStatus(200);
      } else {
        res.sendStatus(401);
      }
    }
  });

  const handleEvent = (body, command) => {
    /* the variable on the left represents the response from a slash command, and
    the variables on the right are coming from an interactive command  */

    const user = body.user_id || body.user.id;
    const channel = body.channel_id || body.channel.id;

    const loc = {
      lat: body.lat,
      long: body.long,
    };

    switch (command) {
      case 'doorbell':
        doorbell(user, channel);
        break;
      case 'standup':
        standup(user, channel, body.trigger_id);
        break;
      case 'cancelStandup':
        cancelStandup(user, channel);
        break;
      case 'submitStandup':
        submitStandup(user, channel, body.submission);
        break;
      case 'gotin':
        gotIn(user, channel);
        break;
      case 'checkin':
        checkIn(user, loc, channel);
        break;
      case 'checkout':
        checkOut(user, loc, channel);
				break;
			case 'register':
				registerNewStudent(body);
        break;
      case 'stats':
				getStudentStats(body);
        break;
      case 'wakatime':
        registerWakatimeKey(body);
        break;
      case 'notAtSchool':
        notAtSchool(body);
        break;
      default:
        break;
    }
  };

// #end-region Slack-bot Routes

  // 9:00am
  const morningReminder = schedule.scheduleJob({ hour: 9, minute: 0 }, () => {
    app.models.student.reminder((err, activeResponse) => {
      if (err) {
        console.log(err);
      }
      else {
        let activeStudents = activeResponse;
        app.models.checkin.active((err, response) => {
          if (err) {
            console.log(err);
          }
          else {
            let checkedInStudents = response;
						let filteredActiveStudents = activeStudents.filter(student => {
							return checkedInStudents.filter(checkedIn => student.slack_id === checkedIn.slack_id).length == 0;
						})
            bot.getUsers()
              .then(users => {
                users.members.forEach(user => {
                  if (filteredActiveStudents.filter(student => student.slack_id === user.id).length > 0) {
                    bot.postEphemeral(
											process.env.STUDENTS_CHANNEL,
											user.id,
											':alarm_clock: Don\'t forget to check in'
										);
                  };
                });
              })
              .catch(err => {
                console.log('error in checkinReminder');
                console.log(err);
              });
          };
        });
      }
    })
  });

  //5:50pm
  const earlyCheckoutReminder = schedule.scheduleJob({ hour: 17, minute: 50 }, () => {
    app.models.student.reminder((err, activeResponse) => {
      if (err) {
        console.log(err);
      }
      else {
        let activeStudents = activeResponse;
        app.models.checkin.active((err, response) => {
          if (err) {
            console.log(err);
          }
          else {
            let checkedInStudents = response;
            bot.getUsers()
              .then(users => {
                users.members.forEach(user => {
                  if (checkedInStudents.filter(e => e.slack_id === user.id).length > 0) {
                    if (activeStudents.filter(s => s.slack_id === user.id).length > 0) {
                      bot.postEphemeral(
                        process.env.STUDENTS_CHANNEL,
                        user.id,
                        ':alarm_clock: Don\'t forget to check out before you leave'
                      );
                    };
                  };
                });
              })
              .catch(err => {
                console.log('error in earlyCheckOutReminder');
                console.log(err);
              });
          };
        });
      }
    })  });

  // 6:15pm
  const lateCheckOutReminder = schedule.scheduleJob({ hour: 18, minute: 15 }, () => {
    var message = {
      'attachments': [
        {
          'title': 'Time to check out!',
          'text': 'Are you still here?',
          'callback_id': 'latecheckout',
          'color': '#3AA3E3',
          'attachment_type': 'default',
          'actions': [
            {
              'name': 'yes',
              'text': 'Yes, please check me out',
              'style': 'primary',
              'type': 'button',
              'value': 'yes',
            },
            {
              'name': 'no',
              'text': 'No',
              'style': 'danger',
              'type': 'button',
              'value': 'no',
            },
          ],
        },
      ],
    };

    app.models.student.reminder((err, activeResponse) => {
      if (err) {
        console.log(err);
      }
      else {
        let activeStudents = activeResponse;
        console.log(activeStudents)
        app.models.checkin.active((err, response) => {
          if (err) {
            console.log(err);
          }
          else {
            let checkedInStudents = response;
            bot.getUsers()
              .then(users => {
                users.members.forEach(user => {
                  if (checkedInStudents.filter(e => e.slack_id === user.id).length > 0) {
                    if (activeStudents.filter(s => s.slack_id === user.id).length > 0) {
                      bot.postEphemeral(process.env.STUDENTS_CHANNEL, user.id, '', message);
                    };
                  };
                });
              })
              .catch(err => {
                console.log('error in lateCheckOutReminder');
                console.log(err);
              });
          };
        });
      }
    });
  });

  // auto-checkout at 6:20pm
  const checkOutCache = schedule.scheduleJob({ hour: 18, minute: 20 }, () => {
    let checkouts = [];
    app.models.checkin.active((err, response) => {
      if (err) {
        console.log('in checkOutCache, an error calling app.models.checkin.active');
        console.log(err);
      }
      else {
        checkouts = response.map(checkin => {
          return app.models.checkin.updateAll(
            { id: checkin.id },
            {
              checkout_time: new Date(),
              hours: (((new Date() - new Date(checkin.checkin_time)) / (1000 * 60 * 60)) - 4),
              auto_checkout: true
              // (milliseconds in a sec) * (seconds in a min) * (minutes in an hour)
            }
          )
            .catch(err => {
              console.log('in checkOutCache, an error calling app.models.checkin.updateAll()');
              console.log(err);
            })
        });
      }
    });
    Promise.all(checkouts)
      .catch(err => {
        console.log('in checkOutCache, an error calling Promise.all to checkout students');
        console.log(err);
      });
  });

  // 2:01 am
  const getDailyWakatimeData = schedule.scheduleJob({ hour: 2, minute: 1}, () => {
    let secondsInADay = 1000 * 60 * 60 * 24;
    let time = new Date(new Date() - secondsInADay);
    let year = time.getFullYear();
    let date = time.getDate();
    let month = time.getMonth() + 1;
    let formattedDate = `${year}-${month.toString().padStart(2, "0")}-${date.toString().padStart(2, "0")}`;
    let studentQueue;
    const studentTypesToFind = ['PAID', 'JOBSEEKER'];

    let formattedTypesArray = studentTypesToFind.map(type => {
      return { type: { eq: type } }
    })

    app.models.student.find({ where: { or: formattedTypesArray } })
      .then(students => {
        studentQueue = studentsGenerator(students);
        getWakatimeDuration(studentQueue.next());
      })

  });    

  function* studentsGenerator(students) {
    for (let i = 0; i < students.length; i++) {
      yield students[i];
    }
  }

  function getWakatimeDuration(student) {
    if (student.done) {
      return;
    }

    axios({
      'method': 'get',
      'url': `https://wakatime.com/api/v1/users/current/durations?date=${formattedDate}`,
      'headers': {
        'Authorization': `Basic ${Buffer.from(student.value.wakatime_key).toString('base64')}`
      }
    })
      .then(res => {
        saveToDatabase(student.value.slack_id, Date.now() - secondsInADay, res.data.data.reduce((sum, codingPeriod) => {
          return sum + codingPeriod.duration;
        }, 0))
        getWakatimeDuration(studentQueue.next());
      })
      .catch(e => {
        console.log(e);
        getWakatimeDuration(studentQueue.next());
      })

    function saveToDatabase(slack_id, date, duration) {
      app.models.wakatime.create({
        'duration': duration,
        'slack_id': slack_id,
        'date': date
      });
    }
  }

  function doorbell(user, channel) {
    var params = {
      icon_url: path.join(__dirname, '../icon.png'),
    };
    var message = {
      'attachments': [
        {
          'text': 'Once inside please click the button below',
          'callback_id': 'gotin',
          'color': '#3AA3E3',
          'attachment_type': 'default',
          'actions': [
            {
              'name': 'yes',
              'text': 'Got In!',
              'type': 'button',
              'value': 'gotin',
            },
          ],
        },
      ],
    };
    bot.postMessage(process.env.KEY_CHANNEL,
      `<@${user}> is at the door.`, params)
      .then((response) => {
        bot.postEphemeral(channel, user, 'Did you get in?', message);
      });
  };

  function gotIn(user, channel) {
    bot.postMessage(process.env.KEY_CHANNEL, "I'm in!", {});
  };

  function standup(userSlackId, channel, trigger_id) {
    let currentStudent = students.find(s => {
      return s.slack_id === userSlackId
    });

      axios({
        'method': 'post',
        'url': 'https://slack.com/api/dialog.open',
        'headers': {
          'Authorization': 'Bearer ' + process.env.OAUTH_ACCESS_TOKEN,
          'content-type': 'application/json',
        },
        'data': {
          'trigger_id': trigger_id,
          'dialog': {
            'callback_id': 'standupResponse',
            'title': 'Daily Standup',
            'submit_label': 'Submit',
            'notify_on_cancel': true,
            'elements': [
              {
                'type': 'textarea',
                'label': 'What did you do since yesterday?',
                'name': 'yesterday',
              },
              {
                'type': 'textarea',
                'label': 'What will you do today?',
                'name': 'today',
              },
              {
                'type': 'textarea',
                'label': 'Is anything blocking your progress?',
                'name': 'blockers',
              },
            ],
          },
        },
      })
        .catch(err => {
          console.log(`error in standup was ${err}`);
        });
  };

  function cancelStandup(user, channel) {
    var params = {
      icon_emoji: ':sadpepe:',
    };
    bot.postEphemeral(
      channel,
      user,
      'Please submit your standup later today.',
      params);
  };

  function submitStandup(user, channel, submission) {
    let currentStudent = students.find(s => s.slack_id === user);

    currentStudent.yesterday = submission.yesterday;
    currentStudent.today = submission.today;
    currentStudent.blockers = submission.blockers;
    currentStudent.submitted = true;
    currentStudent.date = new Date(Date.now());
    var params = {
      icon_emoji: ':pepedance:',
    };
    let newDate = new Date();

    app.models.student.find({ 'where': { 'slack_id': user } })
      .then(student => {
        app.models.standup.create({
          'slack_id': user,
          'date': newDate,
          'tasks_yesterday': submission.yesterday,
          'tasks_today': submission.today,
          'blockers': submission.blockers,
          'studentId': student[0].id,
        });
      })
      .then(response => {
        bot.postEphemeral(channel, user, 'Have a great day!', params);
        adminReport();
      })
      .catch(err => console.log(err));
  };

  function checkIn(slackId, loc, channel) {
    // check the active checkins to see if the current user is already checked in
    app.models.checkin.active((err, response) => {
      if (err) {
        console.log(err);
      }
      else if (response.filter(e => e.slack_id === slackId).length > 0) {
        var params = {
          icon_emoji: ':x:',
        };
        bot.postEphemeral(
          channel,
          slackId,
          'You have already checked in!',
          params);
      }
      else {
        // post message "you have checked in"
        const isNearby =
          (loc.lat && loc.long) && (Math.abs(loc.lat - process.env.LAT) <
            0.0001 && Math.abs(loc.long - process.env.LONG) < 0.0001);

        app.models.checkin
          .create({
            slack_id: slackId,
            checkin_time: new Date(),
            checkout_time: null,
            hours: 0,
          })
          .then(response => {
            app.models.log.checkIn(
              slackId, loc.lat, loc.long, (err, resp) => {
                if (err) {
                  console.log(err);
                  var params = {
                    icon_emoji: ':x:',
                  };
                  bot.postEphemeral(channel, slackId, 'You have already checked in!', params);
                }
                else {
                  var params = {
                    icon_emoji: ':heavy_check_mark:',
                  };
                  bot.postEphemeral(
                    channel,
                    slackId,
                    'You have checked in!',
                    params);
                  if (process.env.EXTERNAL_LOGGING) {
                    axios.post(process.env.EXTERNAL_LOGGING_URL,
                      {
                        slackId,
                        method: 'checkin',
                        loc,
                        isNearby,
                        token: process.env.EXTERNAL_LOGGING_TOKEN,
                      }
                    );
                  };
                }
              });

          })
          .catch(err => {
            console.log(err);
            var params = {
              icon_emoji: ':x:',
            };
            bot.postEphemeral(channel, user, 'Error', params);
          });
      }
    });
  };

  function checkOut(slackId, loc, channel, penalty = 'none') {
    let checkouts = [];
    app.models.checkin.active((err, response) => {
      if (err) {
        console.log(err);
      }
      else {
        let userCheckedIn = response.filter(e => e.slack_id === slackId);
        if (userCheckedIn.length === 0) {
          var params = {
            icon_emoji: ':x:',
          };
          bot.postEphemeral(channel, slackId, 'You have not checked in!', params);
        }
        else {
          const isNearby = (loc.lat && loc.long) &&
            (Math.abs(loc.lat - process.env.LAT) < 0.0001 &&
              Math.abs(loc.long - process.env.LONG) < 0.0001);
          if (penalty === 'none' && !isNearby) {
            penalty = 'notAtSchool';
          }

          checkouts = userCheckedIn.map(checkin => {
            return app.models.checkin.updateAll(
              { id: checkin.id },
              {
                checkout_time: new Date(),
                hours: (new Date() - new Date(checkin.checkin_time)) /
                  (1000 * 60 * 60),
                // (milliseconds in a sec) * (seconds in a min) * (minutes in an hour)
              }
            )
              .catch(err => console.log(err));
          });

          var params = {
            icon_emoji: ':heavy_check_mark:',
          };
          bot.postEphemeral(
            channel,
            slackId,
            penalty === 'timeout' ?
              ':warning: You have been automatically checked out.' :
              'You have checked out!',
            params);

          if (process.env.EXTERNAL_LOGGING) {
            axios.post(process.env.EXTERNAL_LOGGING_URL, {
              slackId,
              method: 'checkout',
              loc,
              isNearby,
              token: process.env.EXTERNAL_LOGGING_TOKEN,
            });
          }
        }
      }
    });
    Promise.all(checkouts).then().catch(err => console.log(err));
	};

  function notAtSchool(user, channel){

    app.models.checkin
            .create({
              checkin_time: new Date(),
              checkout_time: new Date(),
              slack_id: user.user_id,
              hours: 0,
              notAtSchool: true
            })

  let params = {
      icon_emoji: ':smiley:',
      };

    bot.postEphemeral(
        user.channel_id,
        user.user_id,
        `Not at school status has been logged. Have a nice day!`,
        params);
  }

  function registerWakatimeKey(user, channel) {
    axios({
        'method': 'post',
        'url': 'https://slack.com/api/dialog.open',
        'headers': {
          'Authorization': 'Bearer ' + process.env.OAUTH_ACCESS_TOKEN,
          'content-type': 'application/json',
        },
        'data': {
          'trigger_id': user.trigger_id,
          'dialog': {
            'callback_id': 'registerWakatimeKey',
            'title': 'Add Wakatime Key',
            'submit_label': 'Submit',
            'notify_on_cancel': false,
            'elements': [{
              'type': 'textarea',
              'label': 'Please enter your Wakatime API key:',
              'name': 'wakatime_key',
              'optional': false
            }],
          },
        },
      })
      .catch(err => {
        console.log(`error in register was ${err}`);
      });
  }

  function saveWakatimeKey(slackId, key) {
    app.models.student.find({
        where: {
          slack_id: slackId
        }
      })
      .then(result => {
        result[0].updateAttributes({
          wakatime_key: key
        }, (err, instance) => {
          if (err) {
            console.log(err)
          };
          console.log(instance);
          console.log('api key update logged');
        })
      })
      .catch(err => console.log(err));
    (err, result) => {
      addStudentToStudentsArray(result);
    }
  }

	function registerNewStudent(user, channel){
		let currentStudent = students.find(s => {
      return s.slack_id === user.user_id;
		});

    if (currentStudent === undefined) {
      axios({
        'method': 'post',
        'url': 'https://slack.com/api/dialog.open',
        'headers': {
          'Authorization': 'Bearer ' + process.env.OAUTH_ACCESS_TOKEN,
          'content-type': 'application/json',
        },
        'data': {
          'trigger_id': user.trigger_id,
          'dialog': {
            'callback_id': 'registerNewStudent',
            'title': 'Register',
            'submit_label': 'Submit',
            'notify_on_cancel': false,
            'elements': [
              {
                'type': 'textarea',
                'label': 'Please enter your Wakatime API key (if known):',
								'name': 'wakatime_key',
								'optional': true
              }
            ],
          },
        },
			})
      .catch(err => {
        console.log(`error in register was ${err}`);
      });
    } else {
      var params = {
        icon_emoji: ':smiley:',
      };
      bot.postEphemeral(
        user.channel_id,
        user.user_id,
        'You are already registered!',
        params);
    }
	}

	function saveNewStudentToDatabase(slack_id, name, wakatime_key, type){
		app.models.student.create({
			slack_id,
			name,
			wakatime_key,
			type
		}, (err, result) => {
			addStudentToStudentsArray(result);
		})
  }

  function getStudentStats(user, channel){
    let currentStudent = user.user_id;

    let params = {
      icon_emoji: ':smiley:',
    };

    app.models.checkin.hoursPerWeek(currentStudent, (err,result)=>{
      app.models.wakatime.getHours(currentStudent, (err,result2)=>{
        app.models.standup.getStats(currentStudent, (err,result3)=>{
          bot.postEphemeral(
          user.channel_id,
          user.user_id,
          `${result} ${result2} ${result3}`,
          params);
    })
  })
})

  }

  function adminReport() {
    students.map(reports => {
      if (reports.submitted === true && reports.reported === false) {
        let report = `
          <@${reports.slack_id}> @${reports.date.toLocaleString()}
          *${reports.questionOne}*
          - ${reports.yesterday}
          *${reports.questionTwo}*
          - ${reports.today}
          *${reports.questionThree}*
          - ${reports.blockers}
        `;
        bot.postMessage(process.env.ADMIN_REPORTS_CHANNEL, report, { mrkdwn: true });
        reports.reported = true;
      }
    });
  };

  // resets student standups @11:59pm.
  const standupReset = schedule.scheduleJob({ hour: 23, minute: 59 }, () => {
    students.map(reports => {
      reports.reported = false;
      reports.submitted = false;
      reports.yesterday = '';
      reports.today = '';
      reports.blockers = '';
      reports.date = null;
    });
  });

  // 9:00am stand-up reminder
  const earlyReminder = schedule.scheduleJob({ hour: 9, minute: 15 }, () => {
    app.models.student.reminder((err, activeResponse) => {
      if (err) {
        console.log(err);
      }
      else {
        let activeStudents = activeResponse;
        students.forEach(user => {
          if (activeStudents.filter(s => s.slack_id === user.id).length > 0) {
            if (!user.submitted) {
              bot.postEphemeral(
                process.env.STUDENTS_CHANNEL,
                user.slack_id,
                ":alarm_clock: Don't forget to do your Stand-Up!"
              );
            }
          }
        })
      };
    })
  });

  // 1:00pm stand-up reminder
  const lateReminder = schedule.scheduleJob({ hour: 13, minute: 0 }, () => {
    app.models.student.reminder((err, activeResponse) => {
      if (err) {
        console.log(err);
      }
      else {
        let activeStudents = activeResponse;
        students.forEach(user => {
          if (activeStudents.filter(s => s.slack_id === user.id).length > 0) {
            if (!user.submitted) {
              bot.postEphemeral(
                process.env.STUDENTS_CHANNEL,
                user.slack_id,
                ":alarm_clock: Don't forget to do your Stand-Up!"
              );
            }
          }
        })
      };
    });
  });

  function addStudentToStudentsArray(student) {
    students.push(
      {
        slack_id: student.slack_id,
        id: student.id,
        submitted: false,
        reported: false,
        questionOne: 'What did you do since Yesterday?',
        yesterday: '',
        questionTwo: 'What will you do Today?',
        today: '',
        questionThree: 'Anything blocking your progress?',
        blockers: '',
        date: null,
        type: student.type
      }
    );
	}

	function updateStudentInArray(student){
		for(let i = 0; i < students.length; i++){
      if(student.id == students[i].id){
				students[i] = {
					...students[i],
					slack_id: student.slack_id,
					type: student.type
				}
			}
		}
	}
}
