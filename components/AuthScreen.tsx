
import React, { useState } from 'react';
import { GoogleIcon, FacebookIcon, PhoneIcon, SparklesIcon, ShieldCheckIcon } from './icons';

interface AuthScreenProps {
  onLoginSuccess: () => void;
}

type AuthStep = 'initial' | 'mobile' | 'otp' | 'agreement';

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [step, setStep] = useState<AuthStep>('initial');
  const [mobileNumber, setMobileNumber] = useState('');
  const [otp, setOtp] = useState('');
  const FAKE_OTP = '123456'; // For demonstration

  const renderInitialStep = () => (
    <>
      <div className="text-center mb-8">
        <SparklesIcon className="w-12 h-12 mx-auto text-indigo-400 mb-4" />
        <h2 className="text-2xl font-bold text-slate-100">Welcome to Red AI</h2>
        <p className="text-slate-400 mt-2">Your multi-purpose AI assistant.</p>
      </div>
      <div className="space-y-4">
        <button 
          onClick={() => setStep('agreement')}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition-colors"
        >
          <GoogleIcon className="w-6 h-6" />
          Sign in with Google
        </button>
        <button 
          onClick={() => setStep('agreement')}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FacebookIcon className="w-6 h-6" />
          Sign in with Facebook
        </button>
        <button 
          onClick={() => setStep('mobile')}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-slate-700 text-slate-100 font-semibold rounded-lg hover:bg-slate-600 transition-colors"
        >
          <PhoneIcon className="w-6 h-6" />
          Continue with Mobile
        </button>
      </div>
      <p className="text-xs text-center text-slate-500 mt-6">Social & mobile sign-in are for demonstration purposes.</p>
    </>
  );

  const renderMobileStep = () => (
    <>
      <div className="text-center mb-8">
        <PhoneIcon className="w-10 h-10 mx-auto text-indigo-400 mb-4" />
        <h2 className="text-2xl font-bold text-slate-100">Enter your number</h2>
        <p className="text-slate-400 mt-2">We'll text you a code to verify.</p>
      </div>
      <div>
        <input 
          type="tel"
          value={mobileNumber}
          onChange={(e) => setMobileNumber(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="Mobile number"
          className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out text-white"
        />
        <button 
          onClick={() => setStep('otp')}
          disabled={!mobileNumber || mobileNumber.length < 10}
          className="w-full mt-4 bg-indigo-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-200 ease-in-out disabled:bg-indigo-400/50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
         <button onClick={() => setStep('initial')} className="w-full mt-2 text-sm text-slate-400 hover:text-slate-200">
            Back
        </button>
      </div>
    </>
  );

  const renderOtpStep = () => (
    <>
      <div className="text-center mb-8">
        <ShieldCheckIcon className="w-10 h-10 mx-auto text-indigo-400 mb-4" />
        <h2 className="text-2xl font-bold text-slate-100">Verify your number</h2>
        <p className="text-slate-400 mt-2">Enter the 6-digit code. For this demo, the code is <span className="font-bold text-slate-200">{FAKE_OTP}</span>.</p>
      </div>
      <div>
        <input 
          type="tel"
          value={otp}
          maxLength={6}
          onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="123456"
          className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out text-white text-center tracking-[0.5em]"
        />
        <button 
          onClick={() => setStep('agreement')}
          disabled={otp !== FAKE_OTP}
          className="w-full mt-4 bg-indigo-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-200 ease-in-out disabled:bg-indigo-400/50 disabled:cursor-not-allowed"
        >
          Verify
        </button>
         <button onClick={() => setStep('mobile')} className="w-full mt-2 text-sm text-slate-400 hover:text-slate-200">
            Back
        </button>
      </div>
    </>
  );

  const renderAgreementStep = () => (
    <div className="text-center">
      <h2 className="text-2xl font-bold text-slate-100 mb-4">One Last Step</h2>
      <div className="text-left text-sm text-slate-400 space-y-4 p-4 bg-slate-800/50 rounded-lg max-h-60 overflow-y-auto">
        <p>By clicking "Agree & Continue", you agree to the Red AI Terms of Service and acknowledge our Privacy Policy.</p>
        <p>This will grant the application access to your microphone for voice input. Your conversations may be processed by Google's AI services to provide responses.</p>
      </div>
      <button 
          onClick={onLoginSuccess}
          className="w-full mt-6 bg-indigo-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-200 ease-in-out"
        >
          Agree & Continue
        </button>
        <button onClick={() => setStep('initial')} className="w-full mt-2 text-sm text-slate-400 hover:text-slate-200">
            Cancel
        </button>
    </div>
  );

  return (
    <div className="flex items-center justify-center h-full bg-slate-900">
        <div className="w-full max-w-sm p-8 bg-slate-800 rounded-2xl shadow-lg border border-slate-700">
            {step === 'initial' && renderInitialStep()}
            {step === 'mobile' && renderMobileStep()}
            {step === 'otp' && renderOtpStep()}
            {step === 'agreement' && renderAgreementStep()}
        </div>
    </div>
  );
};
