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

const sevenDaysAgoMidnight = midnight(offsetDate(new Date(today), -6));

module.exports = function(github) {
    github.getCommits = function (slackId, callback) {
        github.find({ where: { slack_id: slackId } })
            .then(gitcommits => {
                if (gitcommits.length == 0) {let result = 'no commit data \n'; callback(null,result);return};    

                const lastSevenDays = gitcommits.filter(github => {
                    return new Date(github.date) > sevenDaysAgoMidnight;
                });
                let gitCommitsLastSevenDays = lastSevenDays.reduce((accumulator, github) => {
                    return accumulator + github.commits;
                }, 0);

                let result = `--Number of commits last 7 days: ${gitCommitsLastSevenDays}`
                callback(null, result);
            })
            .catch(err => console.log(err));
    };

    github.remoteMethod(
        'getCommits', {
        http: {
            path: '/github/:slack_id',
            verb: 'get',
        },
        accepts: {
            arg: 'slack_id',
            type: 'string',
            required: true,
            http: { source: 'path' },
        },
        returns: { arg: 'checkins', type: ['checkin'], root: true },
    }
    );
};
