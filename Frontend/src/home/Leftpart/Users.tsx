import User from "./User";
import useGetAllUsers from "../../context/useGetAllUsers";

function Users() {
  const { allUsers } = useGetAllUsers();

  return (
    <div>
      <h1 className="px-8 py-2 text-white font-semibold bg-slate-800 rounded-md">
        Messages
      </h1>
      <div
        className="py-2 flex-1 overflow-y-auto"
        style={{ maxHeight: "calc(84vh - 10vh)" }}
      >
        {allUsers.map((user) => (
          <User key={user._id} user={user} />
        ))}
      </div>
    </div>
  );
}

export default Users;
