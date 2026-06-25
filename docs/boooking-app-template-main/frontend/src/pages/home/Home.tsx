import { useAuth } from "../../contexts/authContext";
import styles from "./home.module.scss";

const Home = () => {
  const { session } = useAuth();

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Home</h1>
      {session && (
        <p className={styles.subtitle}>Welcome, {session.name ?? session.email}</p>
      )}
      {/* Build your application here */}
    </div>
  );
};

export default Home;
