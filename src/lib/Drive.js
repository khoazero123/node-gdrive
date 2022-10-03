const async = require('async');
const fs = require('fs');
const path = require("path");
const {throttle} = require("lodash");
const pMap = require('p-map');
const filesize = require('filesize');
const uuid = require('uuid');
const Client = require('./Client');
const util = require('./util');

class Drive extends Client {
  constructor(options) {
    super(options);

    this.drive = this.google.drive({
      version: 'v3',
      auth: this.client.oAuth2Client
    });
  }

  async list(folderId, options = {}) {
    const self = this;
    const query = {
      pageSize: 10,
      fields: 'nextPageToken, files(id, name)',
    };
    if (folderId) {
      query.q = `'${folderId}' in parents`
    }
    return new Promise((resolve, reject) => {
      self.drive.files.list(query, (err, res) => {
        if (err) return console.log('The API returned an error: ' + err);
        const files = res.data.files;
        resolve(files);
      });
    });
  }

  async upload(distPath, options = {}) {
    const self = this;
    return new Promise(async (resolve, reject) => {
      if (!fs.existsSync(distPath)) {
        let message = 'Path not found: ' + distPath;
        self.writeStdErr(message + "\n");
        if (!this.options.cli) {
          self.emit('error', message);
        }
        return !this.options.cli && reject(new Error(message));
      } else if(fs.lstatSync(distPath).isDirectory()) { // upload folder
        // TODO: create folder
        util.getFiles(distPath).then(async (files) => {
          pMap(files, async (filePath) => {
            return await self.uploadFile(filePath, self.options);
          }, {concurrency: 2});
        }).catch(err => {
          console.error(err);
          reject(err);
        });
      } else { // upload file
        resolve(self.uploadFile(distPath, options));
      }
    });
  }

  uploadFile(filePath, options = {}) {
    this.options = Object.assign({}, this.options, options);
    const self = this;
    const promise = new Promise((resolve, reject) => {
      const fileSize = fs.statSync(filePath).size;

      const requestBody = {
        name: this.options.name || path.basename(filePath)
      };
      if (this.options.parent) {
        requestBody.parents = [this.options.parent];
      }
      if (this.options.description) {
        requestBody.description = this.options.description;
      }
      if (this.options.mime) {
        requestBody.mimeType = this.options.mime;
      }

      self.handlePrintProgress = throttle(data => {
        util.write(data,
          { update: true }
        );
      }, 0);

      self.drive.files.create({
          requestBody: requestBody,
          media: {
            body: fs.createReadStream(filePath)
          }
        }, {
          onUploadProgress: /* throttle( */evt => {
            const percent = ((evt.bytesRead / fileSize) * 100).toFixed(2);
            self.emit('progress', {
              progress: percent,
              bytesRead: evt.bytesRead,
              bytesTotal: fileSize
            });
            self.handlePrintProgress(
              'Uploading ' +
                Math.round(percent) +
                '% ' +
                (filesize(evt.bytesRead, { base: 10, round: 2 }) +
                  '/' +
                  filesize(fileSize, { base: 10 }))
            );
          }/* , 1000) */
        }, function (err, data) {
          if (err) {
            self.emit('error', err);
            self.write("\n"+err.message+"\n");
            return reject(err);
          } else {
            let file = data.data;
            self.emit('done', file);
            self.write(`\nUploaded ${file.id}\n`);
            var promises = [];
            if (self.options.share) {
              let promise = new Promise(function (resolveShare, rejectShare) {
                let share = self.share(file.id, self.options.share);
                share.then(result => {
                  let url = 'https://drive.google.com/uc?export=download&id='+file.id;
                  // let url = 'https://drive.google.com/open?id='+file.id;
                  self.write(`${url}\n`);
                  resolveShare();
                })
                .catch(err => {
                  self.writeStdErr(`Shared error ${err}\n`);
                  rejectShare();
                });
              });
              promises.push(promise.catch(err => {return err;}));
            }
            // console.log(self.options);process.exit(1);
            if (self.options.delete) {
              Promise.all(promises).then(function(values) {
                fs.unlink(filePath, function(err) {
                  if(err) {
                    return self.writeStdErr(`Delete error ${err}\n`);
                  }
                  self.write('Deleted file ' + filePath+ '\n');
                });
              });
            }
            return resolve(file);
          }
        }
      );
    });
    return promise;
  }
  
  share(fileId, permissions = [{ type: 'anyone', role: 'reader' }]) {
    const self = this;
    return new Promise((resolve, reject) => {
      /* var permissions = [{
          type: 'user',
          role: 'writer',
          emailAddress: 'user@example.com'
        }, {
          type: 'domain',
          role: 'writer',
          domain: 'example.com'
        }]; */
      if(!permissions || permissions === true) {
        permissions = [{ type: 'anyone', role: 'reader' }];
      } else if(typeof permissions == 'string') {
        permissions = [{
          type: 'user',
          role: 'reader',
          emailAddress: permissions // is email address
        }];
      }

      async.eachSeries(
        permissions,
        function(permission, permissionCallback) {
          self.drive.permissions.create(
            {
              resource: permission,
              fileId: fileId,
              fields: 'id'
            },
            function(err, res) {
              // res = null
              if (err) {
                permissionCallback(err);
              } else {
                permissionCallback();
              }
            }
          );
        },
        function(err) {
          if (err) {
            return reject(err);
          } else {
            return resolve(true);
          }
        }
      );
    });
  }

  download(fileId, options = {}) {
    const self = this;
    const promise = new Promise((resolve, reject) => {
      self.drive.files.get(
        { fileId, fields: '*' }, async (err, res) => {
          if(err) {
            return reject(err);
          }
          let file = res.data;
          let filePath = path.join(process.cwd(), file.name);
          if(options.randomFileName) {
            filePath = path.join(process.cwd(), uuid()+'.bin');
          }
          if(options.output) {
            let output = options.output;
            
            if (output.endsWith('/')) {
              if (!fs.existsSync(output)) fs.mkdirSync(output);
              filePath = path.join(output, file.name);
            } else { // is file
              filePath = output;
            }
          }
          
          let parameters = { responseType: 'stream' };
          let stats = {size: 0};
          if (fs.existsSync(filePath)) {
            stats = fs.statSync(filePath);
            if(stats.size == file.size) {
              self.write(`File ${filePath} exists!\n`);
              if(!options.force) {
                self.emit('done', filePath);
                return resolve(filePath);
              }
            } else if(options.resumable) {
              parameters.headers = {
                Range: 'bytes=' + stats.size + '-' + file.size
              };
              self.write(`Resume at bytes ${filesize(stats.size)}\n`);
            }
          }
          self.write(`Writing to ${filePath}\n`);

          self.handlePrintProgress = throttle(data => {
            util.write(data, { update: true });
          }, 0);

          const dest = fs.createWriteStream(filePath);
          let progress = 0;
          res = await self.drive.files.get(
            { fileId, alt: 'media' },
            parameters ? parameters : { responseType: 'stream' }
          );
          res.data
            .on('end', () => {
              self.write("\nDone downloading file.\n");
              self.emit('done', filePath);
              resolve(filePath);
            })
            .on('error', err => {
              self.write("\nError downloading file.\n");
              self.emit('error', err);
              reject(err);
            })
            .on('data', /* throttle( */d => {
              progress += d.length;
              const percent = ((progress / file.size) * 100).toFixed(2);
              let statusSize = filesize(progress) + '/' + filesize(file.size);
              let message = `Downloaded ${filesize(progress)} bytes (${statusSize})`;
              self.handlePrintProgress(message);
              self.emit('progress', {
                progress: percent,
                bytesRead: progress,
                bytesTotal: file.size
              });
            }/* , 500) */)
            .pipe(dest);
        }
      );
    });
    return promise;
  }
}

module.exports = new Drive();
