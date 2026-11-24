import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import nodemailer from 'nodemailer';

@Injectable()
export class OtpDelivery {
  readonly enabled=process.env.OTP_ENABLED==='true';
  private readonly from=process.env.OTP_FROM;
  private readonly transport;
  constructor() {
    if (!this.enabled) return;
    const url=process.env.OTP_SMTP_URL;
    if (!url || !this.from || !process.env.OTP_PEPPER || Buffer.byteLength(process.env.OTP_PEPPER)<32) {
      throw new Error('Configure OTP_SMTP_URL, OTP_FROM and a random OTP_PEPPER of at least 32 bytes before enabling OTP');
    }
    const smtp=new URL(url);
    if (!['smtp:','smtps:'].includes(smtp.protocol)) throw new Error('OTP_SMTP_URL must use smtp or smtps');
    const secure=smtp.protocol==='smtps:';
    const host=smtp.hostname;
    const local=['localhost','127.0.0.1','[::1]'].includes(host);
    this.transport=nodemailer.createTransport({
      host,port:Number(smtp.port || (secure?465:587)),secure,requireTLS:!local&&!secure,
      auth:smtp.username ? {user:decodeURIComponent(smtp.username),pass:decodeURIComponent(smtp.password)} : undefined,
      connectionTimeout:5000,greetingTimeout:5000,socketTimeout:10000,
    });
  }
  async send(email:string,code:string) {
    if (!this.transport || !this.from) throw new ServiceUnavailableException('OTP delivery is unavailable');
    try {
      await this.transport.sendMail({from:this.from,to:email,subject:'RCT ERP sign-in code',
        text:'Your RCT ERP sign-in code is '+code+'. It expires in 3 minutes and can only be used once.'});
    } catch {
      throw new ServiceUnavailableException('OTP delivery is unavailable');
    }
  }
}
