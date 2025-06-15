- have to give postgres and redis password yourself.
- Host must have cgroup v1 .
- Permission denied @ rb_sysopen - /box/script.py
---
# error : 
- even by following docs isolate lib used by judge0 can't work properly ( at-least on ubuntu 25+)
```bash
"No such file or directory @ rb_sysopen - /box/script.py"
...
"Failed to create control group /sys/fs/cgroup/memory/box-1/: No such file or directory"
"chown: cannot access '/box': No such file or directory"
```
- as isolate require a bind mount of a host directory (usually /box ) into container.
---

 Judge0 isolate call is trying to create a directory /sys/fs/cgroup/memory/box-4/, then write the container process ID ($$) into /tasks. It fails with:
```bash
 Permission denied
```

>> ROOT CAUSE: 
You’re using a Docker abstraction layer — likely Docker Desktop, rootless Docker, or WSL2.

The actual /sys/fs/cgroup is not a native cgroup mount — it’s a fake (shim) file system, not managed like a true cgroup v1 system.

This fake cgroup FS is read-only or partially virtualized and doesn't allow writing new control groups (like box-5).

--- 
## 🚫 When Docker Desktop is a Problem
Docker Desktop is designed for:

Mac or Windows where Docker cannot run natively

It uses lightweight VMs (HyperKit, WSL2) to emulate Linux

It isolates the host /sys, /proc, and cgroups, meaning:

You cannot mount true /sys/fs/cgroup

Even with privileged: true, cgroup writes fail

You don’t get full Linux kernel isolation features needed by isolate

Docker Desktop works fine for general dev, but fails for system-level sandboxing tools like isolate.

---
### install docker engine 
sudo apt-get update
sudo apt-get install \
  ca-certificates \
  curl \
  gnupg \
  lsb-release

sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

---
- enable docker to start on boot
> sudo systemctl enable docker  ( for boot startup) 
- add user to docker group 
> list groups:  cut -d: -f1 /etc/group
> sudo usermod -aG docker $(whoami)

- might have to configure unix socket in shell config ( bashrc, zshrc ) like
> export DOCKER_HOST=unix:///run/docker.sock


---
## auth techniques
| Technique                   | Works With Access Token? | Works With Refresh Token? | Use Case                        | Complexity  |
| --------------------------- | ------------------------ | ------------------------- | ------------------------------- | ----------- |
| **Short Expiry + Rotation** | ✅ Yes                    | ✅ Yes                     | Most common for access tokens   | Low         |
| **Server-side Blacklist**   | ✅ Yes                    | ✅ Yes                     | Logout, forced revocation       | Medium      |
| **Token Versioning**        | ✅ Yes                    | ✅ Yes                     | User-level invalidation         | Medium      |
| **JTI + Redis**             | ✅ Yes                    | ✅ Yes                     | Fine-grained control (e.g. ban) | Medium-High |
| **Rotate Refresh Tokens**   | ❌ No                     | ✅ Yes                     | Security & refresh expiration   | High        |


---
## jws: json web signed.
```md
<base64(header)>.<base64(payload)>.<base64(signature)>
```