import React, {useState} from 'react';
import ReactDOM from 'react-dom';
import SignIn from './SignIn';
import SignUp from './SignUp';
import ChatApp from './ChatApp';

function Root() {
  const [view, setView] = useState(localStorage.getItem('token') ? 'chat' : 'signin');

  const onSignedIn = () => setView('chat');
  const onSignedUp = () => setView('chat');
  const onLogout = () => setView('signin');

  if (view === 'signin') {
    return <SignIn onSignedIn={onSignedIn} />;
  }
  if (view === 'signup') {
    return <SignUp onSignedUp={onSignedUp} />;
  }
  return <ChatApp onLogout={onLogout} />;
}

ReactDOM.render(<Root />, document.getElementById('root'));