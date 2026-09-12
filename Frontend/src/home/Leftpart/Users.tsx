import Loading from "../../components/Loading";
import User from "./User";
import { useUsers } from "../../hooks/useUsers";

function Users() {
  const { users, loading, error, retry } = useUsers();

  if (loading) return <Loading />;

  if (error) {
    return (
      <div className="px-6 py-8 text-center text-slate-300">
        <p>Unable to load contacts.</p>
        <button type="button" className="btn btn-sm mt-3" onClick={retry}>
          Retry
        </button>
      </div>
    );
  }

  if (users.length === 0) {
    return <p className="px-6 py-8 text-center text-slate-400">No contacts yet.</p>;
  }

  return (
    <div>
      <h1 className="px-8 py-2 text-white font-semibold bg-slate-800 rounded-md">
        Messages
      </h1>
      <div
        className="py-2 flex-1 overflow-y-auto"
        style={{ maxHeight: "calc(84vh - 10vh)" }}
      >
        {users.map((user) => (
          <User key={user._id} user={user} />
        ))}
      </div>
    </div>
  );
}

export default Users;
