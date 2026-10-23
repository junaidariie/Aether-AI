import logo from '../assets/logo.svg';

export default function WelcomeScreen({ name }) {
  return (
    <div className="welcome">
      <div className="welcome-center">
        <div className="welcome-mark" aria-hidden="true"><img src={logo} alt="" width="42" height="42" /></div>
        <h1 className="welcome-greeting">Hello{name?.trim() ? `, ${name.trim()}` : ''}</h1>
        <p className="welcome-sub">What can I help you with today?</p>
      </div>
    </div>
  );
}
