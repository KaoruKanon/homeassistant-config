from .bboxConstant import BboxConstant


class BboxAuth:
    """
    Used to handle the different kind of Auth for each API access
    """

    def __init__(self, local_auth_required, remote_auth_required,
                 authentified, type_of_authentification, auth_cookie=None):
        """

        :param local_auth_required: The auth needed for a local connection
        :param remote_auth_required: The auth needed for a remote connection
        :param authentified: True if the user have already call the login API successfully
        :param type_of_authentification: Is it a remote connection or a local connection
        """
        self.local_auth = local_auth_required
        self.remote_auth = remote_auth_required
        self.authentified = authentified
        self.type_of_auth = type_of_authentification
        self.auth_cookie = auth_cookie

    def is_authentified(self):
        return self.authentified

    def get_auth_access_needed_for_local(self):
        return self.local_auth

    def get_auth_access_needed_for_remote(self):
        return self.remote_auth

    def get_type_of_authentification(self):
        return self.type_of_auth

    def set_access(self, local_access, remote_access):
        self.local_auth = local_access
        self.remote_auth = remote_access

    def set_cookie_id(self, cookie):
        self.auth_cookie = cookie
        if cookie is None:
            self.authentified= False
        else:
            self.authentified = True

    def get_cookie_id(self):
        return self.auth_cookie

    def check_auth(self):
        """
        Check if you can make the API call with your current level of authentification
        :return: true if you can and false if you can't
        """
        if self.type_of_auth == BboxConstant.AUTHENTICATION_TYPE_LOCAL:
            access_level_required = self.get_auth_access_needed_for_local()
        else:
            access_level_required = self.get_auth_access_needed_for_remote()

        if access_level_required == BboxConstant.AUTHENTICATION_LEVEL_NONE:
            return False
        elif access_level_required == BboxConstant.AUTHENTICATION_LEVEL_PRIVATE:
            return self.is_authentified()
        elif access_level_required == BboxConstant.AUTHENTICATION_LEVEL_PUBLIC:
            return True
